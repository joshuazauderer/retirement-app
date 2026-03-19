/**
 * Phase 18 — Health Score Orchestrator
 *
 * Loads all required data from the DB, assembles ComponentInput,
 * delegates to component scorers, and builds the final HealthScoreResult.
 *
 * Never re-computes financial math — reads from stored engine outputs only.
 */

import type { PrismaClient } from '@prisma/client';
import {
  ComponentInput,
  HealthScoreResult,
  HealthScoreTier,
  TIER_LABELS,
  TIER_THRESHOLDS,
  tierFromPercentage,
} from './types';
import { computeAllComponents } from './healthScoreComponentService';
import { getProfileCompletion } from '@/server/services/profileCompletionService';

// Liquid asset types — accessible without penalty before retirement
const LIQUID_ASSET_TYPES = new Set([
  'CHECKING', 'SAVINGS', 'CASH', 'CD', 'BROKERAGE',
]);

// ─── Main Entry Point ────────────────────────────────────────────────────────

export async function computeHealthScore(
  householdId: string,
  prisma: PrismaClient,
): Promise<HealthScoreResult> {
  // ── Load all data in parallel ────────────────────────────────────────────
  const [
    assets,
    liabilities,
    benefits,
    expenses,
    properties,
    latestSimRaw,
    healthcareRuns,
    household,
    profileCompletion,
  ] = await Promise.all([
    prisma.assetAccount.findMany({
      where: { householdId, isActive: true },
      select: { currentBalance: true, type: true },
    }),
    prisma.liability.findMany({
      where: { householdId, isActive: true },
      select: { currentBalance: true },
    }),
    prisma.benefitSource.findMany({
      where: { householdId, isActive: true },
      select: { estimatedMonthlyBenefit: true },
    }),
    prisma.expenseProfile.findUnique({
      where: { householdId },
      select: {
        retirementMonthlyEssential:     true,
        retirementMonthlyDiscretionary: true,
      },
    }),
    prisma.realEstateProperty.findMany({
      where: { householdId },
      select: { currentMarketValue: true, mortgageBalance: true },
    }),
    prisma.simulationRun.findFirst({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      select: {
        endingBalance:      true,
        projectionEndYear:  true,
        projectionStartYear: true,
        firstDepletionYear: true,
        success:            true,
        createdAt:          true,
      },
    }),
    prisma.healthcarePlanningRun.findFirst({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.household.findUnique({
      where: { id: householdId },
      include: {
        members: {
          select: {
            dateOfBirth:         true,
            retirementTargetAge: true,
            lifeExpectancy:      true,
            relationshipType:    true,
          },
        },
      },
    }),
    getProfileCompletion(householdId),
  ]);

  // ── Derive member ages ───────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();

  const primaryMember = household?.members.find(
    m => m.relationshipType === 'PRIMARY',
  );

  const primaryMemberCurrentAge = primaryMember
    ? currentYear - new Date(primaryMember.dateOfBirth).getFullYear()
    : null;

  const primaryMemberLifeExpectancy = primaryMember?.lifeExpectancy ?? null;

  // ── Financial aggregates ─────────────────────────────────────────────────
  const totalAssets = assets.reduce(
    (s, a) => s + Number(a.currentBalance), 0,
  );

  const totalLiquidAssets = assets
    .filter(a => LIQUID_ASSET_TYPES.has(a.type))
    .reduce((s, a) => s + Number(a.currentBalance), 0);

  const totalLiabilities = liabilities.reduce(
    (s, l) => s + Number(l.currentBalance), 0,
  );

  const totalRealEstateValue = properties.reduce(
    (s, p) => s + Number(p.currentMarketValue), 0,
  );

  const totalRealEstateMortgageDebt = properties.reduce(
    (s, p) => s + Number(p.mortgageBalance ?? 0), 0,
  );

  const annualRetirementExpenses = expenses
    ? (Number(expenses.retirementMonthlyEssential) +
       Number(expenses.retirementMonthlyDiscretionary)) * 12
    : 0;

  // Benefits are stored as monthly; annualize for income replacement ratio
  const annualGuaranteedIncome = benefits.reduce(
    (s, b) => s + Number(b.estimatedMonthlyBenefit) * 12, 0,
  );

  // ── Simulation data ──────────────────────────────────────────────────────
  const latestSimulation = latestSimRaw
    ? {
        endingBalance:       Number(latestSimRaw.endingBalance),
        projectionEndYear:   latestSimRaw.projectionEndYear,
        projectionStartYear: latestSimRaw.projectionStartYear,
        firstDepletionYear:  latestSimRaw.firstDepletionYear,
        success:             latestSimRaw.success,
      }
    : null;

  // ── Assemble ComponentInput ───────────────────────────────────────────────
  const input: ComponentInput = {
    totalAssets,
    totalLiabilities,
    totalRealEstateValue,
    totalRealEstateMortgageDebt,
    totalLiquidAssets,
    annualRetirementExpenses,
    annualGuaranteedIncome,
    profileCompletionPct: profileCompletion.percentage,
    latestSimulation,
    hasHealthcarePlan:           !!healthcareRuns,
    primaryMemberCurrentAge,
    primaryMemberLifeExpectancy,
    simulationYearStart:         currentYear,
  };

  // ── Compute components ───────────────────────────────────────────────────
  const components = computeAllComponents(input);

  const totalScore = Math.round(
    components.reduce((s, c) => s + c.earnedPoints, 0),
  );
  const maxScore = components.reduce((s, c) => s + c.maxPoints, 0); // always 100

  const tier: HealthScoreTier = tierFromPercentage(
    Math.round((totalScore / maxScore) * 100),
  );

  // ── Summary narrative ────────────────────────────────────────────────────
  const summary = buildSummary(tier, totalScore, components);

  // ── Top actions (up to 3, sorted by opportunity = maxPoints - earnedPoints) ─
  const topActions = components
    .filter(c => c.actionLabel !== null)
    .sort((a, b) => (b.maxPoints - b.earnedPoints) - (a.maxPoints - a.earnedPoints))
    .slice(0, 3)
    .map(c => c.actionLabel as string);

  return {
    householdId,
    totalScore,
    maxScore,
    tier,
    tierLabel: TIER_LABELS[tier],
    components,
    summary,
    topActions,
    lastComputedAt: new Date().toISOString(),
    dataAsOf: {
      hasSimulation:        !!latestSimRaw,
      hasHealthcarePlan:    !!healthcareRuns,
      hasHousingPlan:       false, // no housing run check needed for score
      latestSimulationDate: latestSimRaw?.createdAt.toISOString() ?? null,
    },
  };
}

// ─── Narrative Builder ───────────────────────────────────────────────────────

function buildSummary(
  tier: HealthScoreTier,
  score: number,
  components: ReturnType<typeof computeAllComponents>,
): string {
  const weakest = components
    .filter(c => c.earnedPoints < c.maxPoints)
    .sort((a, b) => (a.earnedPoints / a.maxPoints) - (b.earnedPoints / b.maxPoints))[0];

  const tierMessages: Record<HealthScoreTier, string> = {
    EXCELLENT: `Your retirement plan is in excellent shape (${score}/100). All key areas are well-addressed — continue reviewing annually.`,
    GOOD: `Your plan is in good shape (${score}/100). A few targeted improvements could push it to excellent.`,
    FAIR: `Your plan is on track but has meaningful gaps (${score}/100). Addressing the key action items below will strengthen your position.`,
    AT_RISK: `Your plan has significant gaps (${score}/100) that may impact retirement security. Prioritize the action items below.`,
    CRITICAL: `Your plan needs immediate attention (${score}/100). Several critical gaps require action before you can retire with confidence.`,
  };

  const base = tierMessages[tier];

  if (weakest && tier !== 'EXCELLENT') {
    return `${base} Your biggest opportunity is in ${weakest.label.toLowerCase()}.`;
  }

  return base;
}

// ─── Threshold export for tests ──────────────────────────────────────────────
export { TIER_THRESHOLDS };
