/**
 * Healthcare Planning Service — Phase 10
 *
 * Main orchestration service for healthcare cost modeling and longevity stress testing.
 *
 * Integrates:
 * - Pre-Medicare cost projection with inflation
 * - Medicare cost estimation (Part B, D, Medigap/MA, IRMAA)
 * - Long-term care stress case injection
 * - Longevity stress (timeline extension to target age)
 *
 * Planning estimates only. Not medical advice. Consult a healthcare planning specialist.
 */

import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '../simulation/buildSimulationSnapshot';
import { applyLongevityStress, primaryAgeInYear, spouseAgeInYear } from './longevityStressService';
import { computeHealthcareCostForYear } from './healthcareCashFlowService';
import type {
  HealthcarePlanningInput,
  HealthcarePlanningRunResult,
  HealthcarePlanningRunSummary,
  HealthcareYearResult,
  HealthcarePlanningSummaryItem,
  HealthcarePlanningValidation,
} from './types';
import type { SimulationSnapshot } from '../simulation/types';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateHealthcarePlanningInput(
  input: HealthcarePlanningInput,
): HealthcarePlanningValidation {
  const errors: string[] = [];

  if (!input.householdId) errors.push('householdId is required');
  if (!input.scenarioId) errors.push('scenarioId is required');
  if (!input.label?.trim()) errors.push('label is required');

  if (input.healthcareInflationRate < 0 || input.healthcareInflationRate > 0.20) {
    errors.push('healthcareInflationRate must be between 0 and 20%');
  }
  if (input.medicareEligibilityAge < 60 || input.medicareEligibilityAge > 70) {
    errors.push('medicareEligibilityAge must be between 60 and 70');
  }

  if (input.ltcStress.enabled) {
    if (input.ltcStress.startAge < 60) errors.push('LTC startAge must be >= 60');
    if (input.ltcStress.durationYears < 1) errors.push('LTC durationYears must be >= 1');
    if (input.ltcStress.annualCost < 0) errors.push('LTC annualCost must be >= 0');
  }

  if (input.longevityStress.enabled) {
    if (input.longevityStress.targetAge < 80 || input.longevityStress.targetAge > 110) {
      errors.push('longevityStress targetAge must be between 80 and 110');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Core projection engine
// ---------------------------------------------------------------------------

export async function runHealthcareProjection(
  snapshot: SimulationSnapshot,
  config: HealthcarePlanningInput,
): Promise<{ yearByYear: HealthcareYearResult[]; summary: HealthcarePlanningRunSummary }> {
  // Apply longevity stress (may extend timeline)
  const { snapshot: projectionSnapshot, extensionYears } = applyLongevityStress(
    snapshot,
    config.longevityStress,
  );

  const baseYear = projectionSnapshot.timeline.simulationYearStart;
  const endYear = projectionSnapshot.timeline.projectionEndYear;

  // Get initial account balances from snapshot
  let totalAssets = projectionSnapshot.assetAccounts.reduce(
    (sum, acc) => sum + (acc.currentBalance ?? 0),
    0,
  );

  // Estimate annual income for IRMAA (sum of all income sources)
  const estimatedAnnualGrossIncome = projectionSnapshot.incomeSources.reduce(
    (sum, inc) => sum + (inc.annualAmount ?? 0),
    0,
  );

  const yearByYear: HealthcareYearResult[] = [];
  let depleted = false;
  let firstDepletionYear: number | undefined;
  let totalHealthcareCost = 0;
  let totalPreMedicareCost = 0;
  let totalMedicareCost = 0;
  let totalLtcCost = 0;
  let peakAnnualHealthcareCost = 0;
  let peakHealthcareCostYear = baseYear;

  for (let year = baseYear; year <= endYear; year++) {
    const primaryAge = primaryAgeInYear(projectionSnapshot, year);
    const spouseAge = spouseAgeInYear(projectionSnapshot, year);

    const cashFlowResult = computeHealthcareCostForYear({
      year,
      primaryAge,
      spouseAge,
      grossIncome: estimatedAnnualGrossIncome,
      snapshot: projectionSnapshot,
      config,
      baseYear,
      accountBalances: {},
    });

    const cost = cashFlowResult.totalHealthcareCost;
    totalAssets = Math.max(0, totalAssets - cost);

    if (!depleted && totalAssets <= 0) {
      depleted = true;
      firstDepletionYear = year;
    }

    totalHealthcareCost += cost;
    totalPreMedicareCost +=
      cashFlowResult.primaryPreMedicareCost + cashFlowResult.spousePreMedicareCost;
    totalMedicareCost +=
      cashFlowResult.primaryMedicareCost + cashFlowResult.spouseMedicareCost;
    totalLtcCost += cashFlowResult.ltcCost;

    if (cost > peakAnnualHealthcareCost) {
      peakAnnualHealthcareCost = cost;
      peakHealthcareCostYear = year;
    }

    yearByYear.push({
      year,
      age: primaryAge,
      spouseAge,
      primaryPreMedicareCost: cashFlowResult.primaryPreMedicareCost,
      primaryMedicareCost: cashFlowResult.primaryMedicareCost,
      spousePreMedicareCost: cashFlowResult.spousePreMedicareCost,
      spouseMedicareCost: cashFlowResult.spouseMedicareCost,
      ltcCost: cashFlowResult.ltcCost,
      totalHealthcareCost: cost,
      primaryOnMedicare: cashFlowResult.primaryOnMedicare,
      spouseOnMedicare: cashFlowResult.spouseOnMedicare,
      ltcActive: cashFlowResult.ltcActive,
      endingAssets: totalAssets,
      depleted: depleted && firstDepletionYear === year,
    });
  }

  const numYears = yearByYear.length;
  const summary: HealthcarePlanningRunSummary = {
    projectionStartYear: baseYear,
    projectionEndYear: endYear,
    totalHealthcareCost,
    totalPreMedicareCost,
    totalMedicareCost,
    totalLtcCost,
    peakAnnualHealthcareCost,
    peakHealthcareCostYear,
    endingAssets: totalAssets,
    success: !depleted,
    firstDepletionYear,
    averageAnnualHealthcareCost: numYears > 0 ? totalHealthcareCost / numYears : 0,
    longevityExtensionYears: extensionYears,
  };

  return { yearByYear, summary };
}

// ---------------------------------------------------------------------------
// Main entry point: validate → load → snapshot → project → persist
// ---------------------------------------------------------------------------

export async function runHealthcarePlanningAnalysis(
  input: HealthcarePlanningInput,
  userId: string,
): Promise<{ runId: string; error?: string }> {
  const validation = validateHealthcarePlanningInput(input);
  if (!validation.valid) {
    return { runId: '', error: validation.errors.join('; ') };
  }

  // Verify scenario belongs to household
  const scenario = await prisma.scenario.findFirst({
    where: { id: input.scenarioId, householdId: input.householdId },
    select: { id: true, name: true },
  });
  if (!scenario) return { runId: '', error: 'Scenario not found' };

  // Verify household belongs to user
  const household = await prisma.household.findFirst({
    where: { id: input.householdId, primaryUserId: userId },
    select: { id: true },
  });
  if (!household) return { runId: '', error: 'Household not found' };

  const snapshot = await buildSimulationSnapshot(input.householdId, prisma);
  const { yearByYear, summary } = await runHealthcareProjection(snapshot, input);

  const run = await prisma.healthcarePlanningRun.create({
    data: {
      householdId: input.householdId,
      scenarioId: input.scenarioId,
      label: input.label,
      healthcareConfigJson: input as unknown as Prisma.InputJsonValue,
      summaryJson: summary as unknown as Prisma.InputJsonValue,
      yearlyJson: yearByYear as unknown as Prisma.InputJsonValue,
      totalHealthcareCost: summary.totalHealthcareCost,
      endingAssets: summary.endingAssets,
      success: summary.success,
      firstDepletionYear: summary.firstDepletionYear ?? null,
      hasLtcStress: input.ltcStress.enabled,
      hasLongevityStress: input.longevityStress.enabled,
      longevityTargetAge: input.longevityStress.enabled ? input.longevityStress.targetAge : null,
      projectionStartYear: summary.projectionStartYear,
      projectionEndYear: summary.projectionEndYear,
    },
  });

  return { runId: run.id };
}

// ---------------------------------------------------------------------------
// List and get runs
// ---------------------------------------------------------------------------

export async function listHealthcarePlanningRuns(
  householdId: string,
): Promise<HealthcarePlanningSummaryItem[]> {
  const runs = await prisma.healthcarePlanningRun.findMany({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  });

  return runs.map((r) => ({
    runId: r.id,
    label: r.label,
    scenarioName: r.scenario?.name ?? 'Unknown',
    createdAt: r.createdAt.toISOString(),
    totalHealthcareCost: r.totalHealthcareCost,
    endingAssets: r.endingAssets,
    success: r.success,
    firstDepletionYear: r.firstDepletionYear ?? undefined,
    hasLtcStress: r.hasLtcStress,
    hasLongevityStress: r.hasLongevityStress,
    longevityTargetAge: r.longevityTargetAge ?? undefined,
  }));
}

export async function getHealthcarePlanningRun(
  runId: string,
  householdId: string,
): Promise<HealthcarePlanningRunResult | null> {
  const run = await prisma.healthcarePlanningRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });

  if (!run) return null;

  return {
    runId: run.id,
    label: run.label,
    scenarioName: run.scenario?.name ?? 'Unknown',
    createdAt: run.createdAt.toISOString(),
    summary: run.summaryJson as unknown as HealthcarePlanningRunSummary,
    yearByYear: run.yearlyJson as unknown as HealthcareYearResult[],
    config: run.healthcareConfigJson as unknown as HealthcarePlanningInput,
  };
}
