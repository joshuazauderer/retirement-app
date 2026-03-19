/**
 * Housing Planning Service
 *
 * Main orchestration for housing + legacy projection runs.
 * Integrates housing events, housing costs, equity release, and legacy projection
 * directly into the annual cash-flow engine loop.
 *
 * Planning-grade only. Not real-estate or legal advice.
 */

import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '../simulation/buildSimulationSnapshot';
import {
  validateHousingPlanningInput,
  loadEffectiveHousingAssumptions,
  getAnnualHousingCostForYear,
} from './housingAssumptionService';
import { computeDownsizingEquityRelease } from './downsizingService';
import { computeRelocationResult } from './relocationService';
import { applyEquityReleaseToAssets } from './equityReleaseService';
import { extractLegacyFromYearByYear } from './legacyProjectionService';
import type {
  HousingPlanningInput,
  HousingPlanningRunResult,
  HousingPlanningRunSummary,
  HousingYearResult,
  HousingPlanningSummaryItem,
  EquityReleaseResult,
  LegacyProjectionResult,
} from './types';
import type { SimulationSnapshot } from '../simulation/types';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Snapshot field helpers
// ---------------------------------------------------------------------------

function getTimelineStart(snapshot: SimulationSnapshot): number {
  return snapshot.timeline.simulationYearStart ?? new Date().getFullYear();
}

function getTimelineEnd(snapshot: SimulationSnapshot): number {
  return snapshot.timeline.projectionEndYear ?? (getTimelineStart(snapshot) + 30);
}

function primaryAgeInYear(snapshot: SimulationSnapshot, year: number): number {
  const primary = snapshot.members?.find((m) => m.isPrimary);
  const startYear = getTimelineStart(snapshot);
  return (primary?.currentAge ?? 65) + (year - startYear);
}

function spouseAgeInYear(snapshot: SimulationSnapshot, year: number): number | undefined {
  const spouse = snapshot.members?.find((m) => !m.isPrimary);
  if (!spouse) return undefined;
  const startYear = getTimelineStart(snapshot);
  return spouse.currentAge + (year - startYear);
}

// ---------------------------------------------------------------------------
// Core projection engine
// ---------------------------------------------------------------------------

export async function runHousingProjection(
  snapshot: SimulationSnapshot,
  config: HousingPlanningInput,
): Promise<{ yearByYear: HousingYearResult[]; summary: HousingPlanningRunSummary; equityRelease?: EquityReleaseResult }> {
  const assumptions = loadEffectiveHousingAssumptions(config);
  const baseYear = getTimelineStart(snapshot);
  const endYear = getTimelineEnd(snapshot);

  // Compute equity release event if applicable
  let equityRelease: EquityReleaseResult | undefined;
  if (config.strategy === 'downsize' && config.downsizing.enabled) {
    equityRelease = computeDownsizingEquityRelease(config.downsizing);
  } else if (config.strategy === 'relocate' && config.relocation.enabled) {
    const relResult = computeRelocationResult(
      config.relocation,
      config.currentProperty.annualHousingCost,
      config.currentProperty.currentValue,
      config.currentProperty.mortgageBalance,
      assumptions.sellingCostPercent,
    );
    equityRelease = relResult.equityRelease;
  }

  // Initial assets from snapshot
  let totalAssets = (snapshot.assetAccounts ?? []).reduce(
    (sum: number, acc) => sum + (acc.currentBalance ?? 0),
    0,
  );

  // Property tracking
  let currentPropertyValue = config.currentProperty.currentValue;
  let currentMortgageBalance = config.currentProperty.mortgageBalance;
  let mortgagePaidOff = currentMortgageBalance <= 0;
  let postEvent = false;
  let totalLifetimeGifting = 0;

  const yearByYear: HousingYearResult[] = [];
  let depleted = false;
  let firstDepletionYear: number | undefined;
  let totalHousingCost = 0;
  let peakAnnualHousingCost = 0;

  for (let year = baseYear; year <= endYear; year++) {
    const primaryAge = primaryAgeInYear(snapshot, year);
    const spouseAge = spouseAgeInYear(snapshot, year);
    let housingEventOccurred = false;
    let equityReleasedThisYear = 0;
    let oneTimeCost = 0;
    let giftingAmount = 0;

    // Housing event: fire in the event year
    const eventYear = assumptions.housingEventYear;
    if (eventYear != null && year === eventYear && !postEvent) {
      housingEventOccurred = true;
      postEvent = true;

      if (equityRelease) {
        equityReleasedThisYear = equityRelease.netReleasedEquity;
        totalAssets = applyEquityReleaseToAssets(totalAssets, equityRelease);
        oneTimeCost = equityRelease.oneTimeMoveCost;

        // Update property tracking post-event
        if (config.strategy === 'downsize' && config.downsizing.buyReplacementHome) {
          currentPropertyValue = config.downsizing.replacementHomeCost;
          currentMortgageBalance = config.downsizing.replacementHomeMortgage;
        } else if (config.strategy === 'relocate' && config.relocation.buyReplacementHome) {
          currentPropertyValue = config.relocation.replacementHomeCost;
          currentMortgageBalance = config.relocation.replacementHomeMortgage;
        } else {
          // Sold, no replacement
          currentPropertyValue = 0;
          currentMortgageBalance = 0;
        }
        mortgagePaidOff = currentMortgageBalance <= 0;
      }
    }

    // Appreciate property
    if (currentPropertyValue > 0) {
      currentPropertyValue *= (1 + assumptions.annualAppreciationRate);
    }

    // Pay down mortgage (simplified straight-line approximation)
    if (currentMortgageBalance > 0 && config.currentProperty.annualMortgagePayment > 0) {
      const principalPortion = config.currentProperty.annualMortgagePayment * 0.6;
      currentMortgageBalance = Math.max(0, currentMortgageBalance - principalPortion);
      if (currentMortgageBalance <= 0) mortgagePaidOff = true;
    }

    // Annual housing cost
    const annualHousingCost = getAnnualHousingCostForYear(assumptions, year, baseYear, mortgagePaidOff);
    const mortgagePayment = mortgagePaidOff ? 0 : config.currentProperty.annualMortgagePayment;

    // Annual gifting
    if (config.gifting.enabled) {
      giftingAmount = config.gifting.annualGiftAmount;
      if (config.gifting.oneTimeGiftYear === year && (config.gifting.oneTimeGiftAmount ?? 0) > 0) {
        giftingAmount += config.gifting.oneTimeGiftAmount ?? 0;
      }
      totalLifetimeGifting += giftingAmount;
      totalAssets = Math.max(0, totalAssets - giftingAmount);
    }

    // Deduct housing costs from assets (simplified: housing costs paid from assets)
    const totalExpenses = annualHousingCost + oneTimeCost;
    totalAssets = Math.max(0, totalAssets - totalExpenses);

    if (!depleted && totalAssets <= 0) {
      depleted = true;
      firstDepletionYear = year;
    }

    totalHousingCost += annualHousingCost;
    if (annualHousingCost > peakAnnualHousingCost) peakAnnualHousingCost = annualHousingCost;

    const estimatedRealEstateEquity = Math.max(0, currentPropertyValue - currentMortgageBalance);

    yearByYear.push({
      year,
      primaryAge,
      spouseAge,
      strategy: postEvent ? config.strategy : 'stay_in_place',
      housingEventOccurred,
      equityReleased: equityReleasedThisYear,
      annualHousingCost,
      mortgagePayment,
      oneTimeCost,
      giftingAmount,
      estimatedPropertyValue: currentPropertyValue,
      estimatedMortgageBalance: currentMortgageBalance,
      estimatedRealEstateEquity,
      totalExpenses,
      withdrawals: totalExpenses,
      endingAssets: totalAssets,
      depleted: depleted && firstDepletionYear === year,
    });
  }

  const lastYear = yearByYear[yearByYear.length - 1];
  const endingRealEstateEquity = lastYear?.estimatedRealEstateEquity ?? 0;
  const projectedNetEstate = (lastYear?.endingAssets ?? 0) + endingRealEstateEquity;

  const summary: HousingPlanningRunSummary = {
    strategy: config.strategy,
    projectionStartYear: baseYear,
    projectionEndYear: endYear,
    housingEventYear: assumptions.housingEventYear,
    netReleasedEquity: equityRelease?.netReleasedEquity ?? 0,
    totalLifetimeHousingCost: totalHousingCost,
    totalLifetimeGifting,
    endingFinancialAssets: lastYear?.endingAssets ?? 0,
    endingRealEstateEquity,
    projectedNetEstate,
    success: !depleted,
    firstDepletionYear,
    peakAnnualHousingCost,
    averageAnnualHousingCost: yearByYear.length > 0 ? totalHousingCost / yearByYear.length : 0,
  };

  return { yearByYear, summary, equityRelease };
}

// ---------------------------------------------------------------------------
// Main entry point: validate → load → snapshot → project → persist
// ---------------------------------------------------------------------------

export async function runHousingPlanningAnalysis(
  input: HousingPlanningInput,
  userId: string,
): Promise<{ runId: string; error?: string }> {
  const validation = validateHousingPlanningInput(input);
  if (!validation.valid) {
    return { runId: '', error: validation.errors.join('; ') };
  }

  const scenario = await prisma.scenario.findFirst({
    where: { id: input.scenarioId, householdId: input.householdId },
    select: { id: true, name: true },
  });
  if (!scenario) return { runId: '', error: 'Scenario not found' };

  const household = await prisma.household.findFirst({
    where: { id: input.householdId, primaryUserId: userId },
    select: { id: true },
  });
  if (!household) return { runId: '', error: 'Household not found' };

  const snapshot = await buildSimulationSnapshot(input.householdId, prisma);
  const { yearByYear, summary, equityRelease } = await runHousingProjection(snapshot, input);
  const legacyProjection = extractLegacyFromYearByYear(yearByYear, summary.totalLifetimeGifting);

  const run = await prisma.housingPlanningRun.create({
    data: {
      householdId: input.householdId,
      scenarioId: input.scenarioId,
      label: input.label,
      housingConfigJson: input as unknown as Prisma.InputJsonValue,
      summaryJson: summary as unknown as Prisma.InputJsonValue,
      yearlyJson: yearByYear as unknown as Prisma.InputJsonValue,
      equityReleaseJson: equityRelease ? (equityRelease as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      legacyJson: legacyProjection ? (legacyProjection as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      strategy: input.strategy,
      netReleasedEquity: summary.netReleasedEquity,
      endingFinancialAssets: summary.endingFinancialAssets,
      projectedNetEstate: summary.projectedNetEstate,
      success: summary.success,
      firstDepletionYear: summary.firstDepletionYear ?? null,
      hasDownsizing: input.downsizing.enabled,
      hasRelocation: input.relocation.enabled,
      projectionStartYear: summary.projectionStartYear,
      projectionEndYear: summary.projectionEndYear,
    },
  });

  return { runId: run.id };
}

// ---------------------------------------------------------------------------
// List and get runs
// ---------------------------------------------------------------------------

export async function listHousingPlanningRuns(householdId: string): Promise<HousingPlanningSummaryItem[]> {
  const runs = await prisma.housingPlanningRun.findMany({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  });

  return runs.map((r) => ({
    runId: r.id,
    label: r.label,
    scenarioName: r.scenario?.name ?? 'Unknown',
    createdAt: r.createdAt.toISOString(),
    strategy: r.strategy as import('./types').HousingStrategy,
    netReleasedEquity: r.netReleasedEquity,
    endingFinancialAssets: r.endingFinancialAssets,
    projectedNetEstate: r.projectedNetEstate,
    success: r.success,
    firstDepletionYear: r.firstDepletionYear ?? undefined,
    hasDownsizing: r.hasDownsizing,
    hasRelocation: r.hasRelocation,
  }));
}

export async function getHousingPlanningRun(
  runId: string,
  householdId: string,
): Promise<HousingPlanningRunResult | null> {
  const run = await prisma.housingPlanningRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });
  if (!run) return null;

  return {
    runId: run.id,
    label: run.label,
    scenarioName: run.scenario?.name ?? 'Unknown',
    createdAt: run.createdAt.toISOString(),
    summary: run.summaryJson as unknown as HousingPlanningRunSummary,
    yearByYear: run.yearlyJson as unknown as HousingYearResult[],
    equityRelease: run.equityReleaseJson ? run.equityReleaseJson as unknown as EquityReleaseResult : undefined,
    legacyProjection: run.legacyJson ? run.legacyJson as unknown as LegacyProjectionResult : undefined,
    config: run.housingConfigJson as unknown as HousingPlanningInput,
  };
}
