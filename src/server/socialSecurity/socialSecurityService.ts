/**
 * Social Security Service — Phase 8
 *
 * Orchestrates: input validation → snapshot building → SS benefit projection
 * → couple coordination → survivor analysis → result persistence.
 *
 * This is the single public entry point for running a Social Security
 * planning analysis. Business logic lives in the subordinate services.
 */

import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '@/server/simulation/buildSimulationSnapshot';
import { mergeScenarioOverrides } from '@/server/scenarios/scenarioSnapshotMergeService';
import { getMemberAgeAtYear } from '@/server/simulation/normalizeInputs';
import type { ScenarioOverridePayload } from '@/server/scenarios/types';
import type { NormalizedBenefitSource, NormalizedMember, SimulationSnapshot } from '@/server/simulation/types';
import { Prisma } from '@prisma/client';
import {
  computeAdjustmentFactor,
  backCalculateFRABenefit,
  adjustBenefitForClaimAge,
  calculateBreakEvenAge,
  getFullRetirementAge,
  validateClaimAge,
} from './claimingAdjustmentService';
import { applyColaBenefit, computeSurvivorBenefit, computeSurvivorExpenses, computeSurvivorIncomeGap } from './survivorBenefitService';
import { projectCoupleSocialSecurity } from './coupleCoordinationService';
import { getMemberAgeAtYear as getAge } from '@/server/simulation/normalizeInputs';
import type {
  SocialSecurityInput,
  SocialSecurityPlanningRunResult,
  SocialSecurityRunSummaryItem,
  SocialSecurityValidation,
  SocialSecurityMemberSummary,
  SocialSecurityYearResult,
  SocialSecurityHouseholdYearResult,
  SurvivorTransitionResult,
  CoupleRetirementCoordinationResult,
} from './types';
import { SS_BOUNDS } from './types';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateSocialSecurityInput(
  input: SocialSecurityInput,
): SocialSecurityValidation {
  const errors: string[] = [];

  if (!input.householdId) errors.push('Household ID is required.');
  if (!input.scenarioId) errors.push('Scenario ID is required.');

  if (input.claimAgeOverrides) {
    for (const [memberId, age] of Object.entries(input.claimAgeOverrides)) {
      const err = validateClaimAge(age);
      if (err) errors.push(`Member ${memberId}: ${err}`);
    }
  }

  if (input.survivorExpenseRatio !== undefined) {
    if (input.survivorExpenseRatio <= 0 || input.survivorExpenseRatio > 1) {
      errors.push('survivor expense ratio must be between 0 (exclusive) and 1 (inclusive).');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Single-member SS projection (no couple logic)
// ---------------------------------------------------------------------------

function projectSingleMemberSS(
  member: NormalizedMember,
  ssBenefit: NormalizedBenefitSource,
  effectiveClaimAge: number,
  projectionStartYear: number,
  projectionEndYear: number,
): SocialSecurityYearResult[] {
  const results: SocialSecurityYearResult[] = [];
  let claimStartYear: number | null = null;
  const fraEquivalentBenefit = backCalculateFRABenefit(ssBenefit.annualBenefit, ssBenefit.claimAge ?? SS_BOUNDS.FULL_RETIREMENT_AGE);
  const adjustedBenefit = adjustBenefitForClaimAge(fraEquivalentBenefit, effectiveClaimAge);

  for (let year = projectionStartYear; year <= projectionEndYear; year++) {
    const age = getMemberAgeAtYear(member.dateOfBirth, year);
    const alive = age <= member.lifeExpectancy;
    if (!alive) {
      results.push({
        year,
        memberId: member.memberId,
        age,
        alive: false,
        hasClaimed: false,
        annualBenefit: 0,
        survivorBenefit: 0,
        effectiveBenefit: 0,
      });
      break;
    }

    const hasClaimed = age >= effectiveClaimAge;
    if (hasClaimed && claimStartYear === null) claimStartYear = year;

    const yearsActive = claimStartYear !== null ? year - claimStartYear : 0;
    const annualBenefit = hasClaimed
      ? applyColaBenefit(adjustedBenefit, ssBenefit.colaRate, yearsActive)
      : 0;

    results.push({
      year,
      memberId: member.memberId,
      age,
      alive,
      hasClaimed,
      annualBenefit,
      survivorBenefit: 0,
      effectiveBenefit: annualBenefit,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main run function
// ---------------------------------------------------------------------------

export async function runSocialSecurityAnalysis(
  input: SocialSecurityInput,
): Promise<SocialSecurityPlanningRunResult> {
  // 1. Validate input
  const validation = validateSocialSecurityInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid Social Security input: ${validation.errors.join('; ')}`);
  }

  // 2. Load scenario
  const scenario = await prisma.scenario.findFirst({
    where: { id: input.scenarioId, householdId: input.householdId },
  });
  if (!scenario) throw new Error('Scenario not found or access denied.');

  // 3. Build baseline snapshot + apply scenario overrides
  const baselineSnapshot = await buildSimulationSnapshot(input.householdId, prisma);
  const overrides = scenario.overridesJson as ScenarioOverridePayload | null;
  const effectiveSnapshot = mergeScenarioOverrides(
    baselineSnapshot,
    overrides,
    scenario.id,
    scenario.name,
  );

  const {
    members,
    benefitSources,
    expenseProfile,
    planningAssumptions,
    timeline,
  } = effectiveSnapshot;

  const projectionStartYear = timeline.simulationYearStart;
  const projectionEndYear = timeline.projectionEndYear;

  // 4. Identify SS benefit sources per member
  const ssBenefitsByMember = new Map<string, NormalizedBenefitSource>();
  for (const b of benefitSources) {
    if (b.type === 'SOCIAL_SECURITY' && b.memberId) {
      // If multiple SS sources per member, use the first active one
      if (!ssBenefitsByMember.has(b.memberId)) {
        ssBenefitsByMember.set(b.memberId, b);
      }
    }
  }

  const fra = getFullRetirementAge();
  const survivorExpenseRatio = input.survivorExpenseRatio ?? SS_BOUNDS.DEFAULT_SURVIVOR_EXPENSE_RATIO;

  // 5. Build member summaries
  const memberSummaries: SocialSecurityMemberSummary[] = [];
  const primaryMember = members.find((m) => m.isPrimary) ?? members[0];
  const spouseMember = members.find((m) => !m.isPrimary && m.memberId !== primaryMember.memberId);

  // ---- Single-member path ----
  if (!spouseMember || members.length === 1) {
    const member = primaryMember;
    const ssBenefit = ssBenefitsByMember.get(member.memberId);

    if (!ssBenefit) {
      // No SS benefit data — return empty result
      return buildEmptyResult(input, scenario.name, projectionStartYear, projectionEndYear);
    }

    const effectiveClaimAge = input.claimAgeOverrides?.[member.memberId] ?? ssBenefit.claimAge ?? fra;
    const fraEquivalent = backCalculateFRABenefit(ssBenefit.annualBenefit, ssBenefit.claimAge ?? fra);
    const adjustedBenefit = adjustBenefitForClaimAge(fraEquivalent, effectiveClaimAge);
    const adjustmentFactor = computeAdjustmentFactor(effectiveClaimAge);
    const breakEvenAge = calculateBreakEvenAge(fraEquivalent, effectiveClaimAge);

    const yearlyResults = projectSingleMemberSS(
      member,
      ssBenefit,
      effectiveClaimAge,
      projectionStartYear,
      projectionEndYear,
    );

    const totalLifetimeBenefit = yearlyResults.reduce((s, y) => s + y.effectiveBenefit, 0);

    memberSummaries.push({
      memberId: member.memberId,
      firstName: member.firstName,
      fra,
      claimAge: effectiveClaimAge,
      fraEquivalentAnnualBenefit: fraEquivalent,
      adjustedAnnualBenefit: adjustedBenefit,
      adjustmentFactor,
      breakEvenAgeVsFRA: breakEvenAge,
      totalLifetimeBenefit,
      yearlyResults,
    });

    // Build household year-by-year from single member
    const coupleBaseExpenses =
      expenseProfile.retirementEssential +
      expenseProfile.retirementDiscretionary +
      expenseProfile.healthcareAnnual +
      expenseProfile.housingAnnual ||
      expenseProfile.currentAnnualSpending * 0.8;

    const yearByYear: SocialSecurityHouseholdYearResult[] = yearlyResults.map((yr, i) => {
      const yearsFromStart = yr.year - projectionStartYear;
      const projectedExpenses = coupleBaseExpenses *
        Math.pow(1 + planningAssumptions.inflationRate, yearsFromStart);
      return {
        year: yr.year,
        memberResults: [yr],
        totalHouseholdBenefit: yr.effectiveBenefit,
        isSurvivorPhase: false,
        projectedExpenses,
        survivorExpenses: 0,
      };
    });

    const totalHouseholdBenefit = totalLifetimeBenefit;
    const label = input.label ?? buildLabel([{ memberId: member.memberId, claimAge: effectiveClaimAge }], members);

    const run = await prisma.socialSecurityRun.create({
      data: {
        householdId: input.householdId,
        scenarioId: input.scenarioId,
        label,
        inputJson: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
        resultJson: Prisma.JsonNull,  // will be set below after we have the full result
        totalLifetimeBenefit: totalHouseholdBenefit,
        breakEvenAge: breakEvenAge,
        projectionStartYear,
        projectionEndYear,
      },
    });

    const result: SocialSecurityPlanningRunResult = {
      runId: run.id,
      householdId: input.householdId,
      scenarioId: input.scenarioId,
      scenarioName: scenario.name,
      label,
      createdAt: run.createdAt.toISOString(),
      memberSummaries,
      coupleCoordination: null,
      survivorTransition: null,
      totalHouseholdLifetimeBenefit: totalHouseholdBenefit,
      yearByYear,
      projectionStartYear,
      projectionEndYear,
    };

    // Update with full result JSON
    await prisma.socialSecurityRun.update({
      where: { id: run.id },
      data: { resultJson: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue },
    });

    return result;
  }

  // ---- Couple path ----
  const primary = primaryMember;
  const spouse = spouseMember;

  const primarySS = ssBenefitsByMember.get(primary.memberId);
  const spouseSS = ssBenefitsByMember.get(spouse.memberId);

  // Handle missing SS data gracefully — treat missing as zero
  const primaryClaimAge = input.claimAgeOverrides?.[primary.memberId] ??
    primarySS?.claimAge ?? fra;
  const spouseClaimAge = input.claimAgeOverrides?.[spouse.memberId] ??
    spouseSS?.claimAge ?? fra;

  const primaryFRA = primarySS
    ? backCalculateFRABenefit(primarySS.annualBenefit, primarySS.claimAge ?? fra)
    : 0;
  const spouseFRA = spouseSS
    ? backCalculateFRABenefit(spouseSS.annualBenefit, spouseSS.claimAge ?? fra)
    : 0;

  const primaryAdjusted = adjustBenefitForClaimAge(primaryFRA, primaryClaimAge);
  const spouseAdjusted = adjustBenefitForClaimAge(spouseFRA, spouseClaimAge);

  const coupleBaseExpenses =
    (expenseProfile.retirementEssential +
      expenseProfile.retirementDiscretionary +
      expenseProfile.healthcareAnnual +
      expenseProfile.housingAnnual) ||
    expenseProfile.currentAnnualSpending * 0.8;

  const { yearByYear, coordination, survivorTransition } = projectCoupleSocialSecurity(
    {
      memberId: primary.memberId,
      firstName: primary.firstName,
      dateOfBirth: primary.dateOfBirth,
      lifeExpectancy: primary.lifeExpectancy,
      retirementTargetAge: primary.retirementTargetAge,
      claimAge: primaryClaimAge,
      adjustedAnnualBenefit: primaryAdjusted,
      colaRate: primarySS?.colaRate ?? 0.023,
    },
    {
      memberId: spouse.memberId,
      firstName: spouse.firstName,
      dateOfBirth: spouse.dateOfBirth,
      lifeExpectancy: spouse.lifeExpectancy,
      retirementTargetAge: spouse.retirementTargetAge,
      claimAge: spouseClaimAge,
      adjustedAnnualBenefit: spouseAdjusted,
      colaRate: spouseSS?.colaRate ?? 0.023,
    },
    {
      coupleBaseExpenses,
      inflationRate: planningAssumptions.inflationRate,
      simulationYearStart: projectionStartYear,
      survivorExpenseRatio,
    },
    projectionStartYear,
    projectionEndYear,
  );

  // Build per-member summaries from couple year-by-year
  const primaryYearResults = yearByYear.map((y) =>
    y.memberResults.find((r) => r.memberId === primary.memberId)!,
  ).filter(Boolean);
  const spouseYearResults = yearByYear.map((y) =>
    y.memberResults.find((r) => r.memberId === spouse.memberId)!,
  ).filter(Boolean);

  const primaryTotalBenefit = primaryYearResults.reduce((s, y) => s + y.effectiveBenefit, 0);
  const spouseTotalBenefit = spouseYearResults.reduce((s, y) => s + y.effectiveBenefit, 0);

  memberSummaries.push({
    memberId: primary.memberId,
    firstName: primary.firstName,
    fra,
    claimAge: primaryClaimAge,
    fraEquivalentAnnualBenefit: primaryFRA,
    adjustedAnnualBenefit: primaryAdjusted,
    adjustmentFactor: computeAdjustmentFactor(primaryClaimAge),
    breakEvenAgeVsFRA: calculateBreakEvenAge(primaryFRA, primaryClaimAge),
    totalLifetimeBenefit: primaryTotalBenefit,
    yearlyResults: primaryYearResults,
  });

  memberSummaries.push({
    memberId: spouse.memberId,
    firstName: spouse.firstName,
    fra,
    claimAge: spouseClaimAge,
    fraEquivalentAnnualBenefit: spouseFRA,
    adjustedAnnualBenefit: spouseAdjusted,
    adjustmentFactor: computeAdjustmentFactor(spouseClaimAge),
    breakEvenAgeVsFRA: calculateBreakEvenAge(spouseFRA, spouseClaimAge),
    totalLifetimeBenefit: spouseTotalBenefit,
    yearlyResults: spouseYearResults,
  });

  const totalHouseholdBenefit = yearByYear.reduce((s, y) => s + y.totalHouseholdBenefit, 0);

  const label = input.label ?? buildLabel(
    [
      { memberId: primary.memberId, claimAge: primaryClaimAge },
      { memberId: spouse.memberId, claimAge: spouseClaimAge },
    ],
    members,
  );

  // Persist — store full result
  const run = await prisma.socialSecurityRun.create({
    data: {
      householdId: input.householdId,
      scenarioId: input.scenarioId,
      label,
      inputJson: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue,
      resultJson: Prisma.JsonNull,
      totalLifetimeBenefit: totalHouseholdBenefit,
      breakEvenAge: memberSummaries[0]?.breakEvenAgeVsFRA ?? null,
      projectionStartYear,
      projectionEndYear,
    },
  });

  const result: SocialSecurityPlanningRunResult = {
    runId: run.id,
    householdId: input.householdId,
    scenarioId: input.scenarioId,
    scenarioName: scenario.name,
    label,
    createdAt: run.createdAt.toISOString(),
    memberSummaries,
    coupleCoordination: coordination,
    survivorTransition,
    totalHouseholdLifetimeBenefit: totalHouseholdBenefit,
    yearByYear,
    projectionStartYear,
    projectionEndYear,
  };

  await prisma.socialSecurityRun.update({
    where: { id: run.id },
    data: { resultJson: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue },
  });

  return result;
}

// ---------------------------------------------------------------------------
// List and get
// ---------------------------------------------------------------------------

export async function listSocialSecurityRuns(
  householdId: string,
): Promise<SocialSecurityRunSummaryItem[]> {
  const runs = await prisma.socialSecurityRun.findMany({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  });

  return runs.map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = r.resultJson as any;
    const claimAges: Record<string, number> = {};
    if (result?.memberSummaries) {
      for (const ms of result.memberSummaries) {
        claimAges[ms.memberId] = ms.claimAge;
      }
    }
    return {
      runId: r.id,
      label: r.label ?? 'SS Analysis',
      scenarioName: r.scenario?.name ?? 'Unknown scenario',
      claimAges,
      totalLifetimeBenefit: Number(r.totalLifetimeBenefit),
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function getSocialSecurityRun(
  runId: string,
  householdId: string,
): Promise<SocialSecurityPlanningRunResult | null> {
  const run = await prisma.socialSecurityRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });
  if (!run) return null;

  return run.resultJson as unknown as SocialSecurityPlanningRunResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLabel(
  claimConfigs: Array<{ memberId: string; claimAge: number }>,
  members: NormalizedMember[],
): string {
  const parts = claimConfigs.map(({ memberId, claimAge }) => {
    const m = members.find((m) => m.memberId === memberId);
    const name = m?.firstName ?? memberId;
    return `${name} @ ${claimAge}`;
  });
  return `SS: ${parts.join(', ')}`;
}

function buildEmptyResult(
  input: SocialSecurityInput,
  scenarioName: string,
  projectionStartYear: number,
  projectionEndYear: number,
): SocialSecurityPlanningRunResult {
  return {
    runId: 'no-ss-data',
    householdId: input.householdId,
    scenarioId: input.scenarioId,
    scenarioName,
    label: input.label ?? 'SS Analysis (no data)',
    createdAt: new Date().toISOString(),
    memberSummaries: [],
    coupleCoordination: null,
    survivorTransition: null,
    totalHouseholdLifetimeBenefit: 0,
    yearByYear: [],
    projectionStartYear,
    projectionEndYear,
  };
}
