/**
 * Withdrawal Strategy Service — Phase 7
 *
 * Orchestrates: input validation → snapshot building → engine execution
 * → result shaping → persistence.
 *
 * This is the single public entry point for running a withdrawal strategy
 * analysis. All business logic stays in the policy and ordering services.
 */

import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '@/server/simulation/buildSimulationSnapshot';
import { validateSimulationInputs } from '@/server/simulation/validateSimulationInputs';
import { mergeScenarioOverrides } from '@/server/scenarios/scenarioSnapshotMergeService';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import type { ScenarioOverridePayload } from '@/server/scenarios/types';
import type {
  WithdrawalStrategyRunInput,
  WithdrawalStrategyRunResult,
  WithdrawalStrategySummaryItem,
  WithdrawalStrategyValidation,
  WithdrawalYearResult,
  WS_BOUNDS,
} from './types';
import { WS_BOUNDS as BOUNDS } from './types';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateWithdrawalStrategyInput(
  input: WithdrawalStrategyRunInput
): WithdrawalStrategyValidation {
  const errors: string[] = [];

  if (!input.householdId) errors.push('Household ID is required.');
  if (!input.scenarioId) errors.push('Scenario ID is required.');
  if (!input.config) errors.push('Strategy configuration is required.');

  const { config } = input;
  if (config) {
    const { strategyType, orderingType, annualWithdrawalTarget, guardrailConfig } = config;

    if (!strategyType) errors.push('Strategy type is required.');
    if (!orderingType) errors.push('Ordering type is required.');

    if (strategyType === 'FIXED_NOMINAL' || strategyType === 'FIXED_REAL') {
      if (annualWithdrawalTarget === undefined || annualWithdrawalTarget < 0) {
        errors.push('Annual withdrawal target must be a non-negative number for fixed strategies.');
      }
      if (annualWithdrawalTarget !== undefined && annualWithdrawalTarget > BOUNDS.MAX_WITHDRAWAL) {
        errors.push(`Annual withdrawal target cannot exceed $${BOUNDS.MAX_WITHDRAWAL.toLocaleString()}.`);
      }
    }

    if (strategyType === 'GUARDRAIL') {
      if (!guardrailConfig) {
        errors.push('Guardrail configuration is required for the GUARDRAIL strategy.');
      } else {
        const g = guardrailConfig;
        if (g.initialAnnualWithdrawal < 0) errors.push('Guardrail initial withdrawal must be non-negative.');
        if (g.lowerGuardrailPct <= 0 || g.lowerGuardrailPct >= 1) errors.push('Lower guardrail must be between 0 and 1.');
        if (g.upperGuardrailPct <= 1) errors.push('Upper guardrail must be greater than 1.');
        if (g.lowerGuardrailPct >= g.upperGuardrailPct) errors.push('Lower guardrail must be less than upper guardrail.');
        if (g.decreaseStepPct <= 0 || g.decreaseStepPct >= 1) errors.push('Decrease step must be between 0 and 1.');
        if (g.increaseStepPct <= 0 || g.increaseStepPct >= 1) errors.push('Increase step must be between 0 and 1.');
        if (g.floorAnnualWithdrawal < 0) errors.push('Floor withdrawal must be non-negative.');
        if (g.ceilingMultiplier <= 1) errors.push('Ceiling multiplier must be greater than 1.');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Run execution
// ---------------------------------------------------------------------------

export async function runWithdrawalStrategy(
  input: WithdrawalStrategyRunInput
): Promise<WithdrawalStrategyRunResult> {
  // 1. Validate input
  const validation = validateWithdrawalStrategyInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid withdrawal strategy input: ${validation.errors.join('; ')}`);
  }

  // 2. Load scenario (scope to household)
  const scenario = await prisma.scenario.findFirst({
    where: { id: input.scenarioId, householdId: input.householdId },
  });
  if (!scenario) throw new Error('Scenario not found or access denied.');

  // 3. Build baseline snapshot
  const baselineSnapshot = await buildSimulationSnapshot(input.householdId, prisma);

  // 4. Validate baseline data completeness
  const simValidation = validateSimulationInputs(baselineSnapshot);
  if (!simValidation.valid) {
    throw new Error(`Household data incomplete: ${simValidation.errors.join('; ')}`);
  }

  // 5. Merge scenario overrides
  const overrides = scenario.overridesJson as ScenarioOverridePayload | null;
  const effectiveSnapshot = mergeScenarioOverrides(
    baselineSnapshot,
    overrides,
    scenario.id,
    scenario.name
  );

  // 6. Build annualReturns vector for sequence risk runs
  // null entries in annualReturnOverrides mean "use baseline return for that year"
  let annualReturns: number[] | undefined;
  if (input.annualReturnOverrides && input.annualReturnOverrides.length > 0) {
    const baselineReturn = effectiveSnapshot.planningAssumptions.expectedPortfolioReturn;
    annualReturns = input.annualReturnOverrides.map((r) =>
      r !== null ? r : baselineReturn
    );
  }

  // 7. Run the engine with withdrawal policy + ordering injected
  const projectionResult = runDeterministicProjection(effectiveSnapshot, {
    annualReturns,
    withdrawalPolicy: input.config,
    orderingType: input.config.orderingType,
  });

  // 8. Shape year-by-year results
  const retirementYears = projectionResult.yearByYear.filter((y) =>
    Object.values(y.memberRetired).some((r) => r)
  );

  const yearByYear: WithdrawalYearResult[] = projectionResult.yearByYear.map((y) => ({
    year: y.year,
    beginningAssets: y.beginningTotalAssets,
    requestedWithdrawal: y.policyWithdrawalTarget ?? y.requiredWithdrawal,
    actualWithdrawal: y.actualWithdrawal,
    withdrawalByBucket: y.withdrawalsByBucket,
    withdrawalByAccount: y.withdrawalsByAccount ?? {},
    shortfall: y.shortfall,
    expenses: y.expenses,
    benefits: y.benefitsIncome,
    taxes: y.taxes,
    endingAssets: y.endingTotalAssets,
    depleted: y.depleted,
    guardrailDirection: y.guardrailDirection ?? 'none',
  }));

  // 9. Compute summary stats
  const retirementActual = retirementYears.map((y) => y.actualWithdrawal);
  const averageAnnualWithdrawal =
    retirementActual.length > 0
      ? retirementActual.reduce((s, v) => s + v, 0) / retirementActual.length
      : 0;
  const maxAnnualWithdrawal = retirementActual.length > 0
    ? Math.max(...retirementActual)
    : 0;
  const yearsFullyFunded = projectionResult.yearByYear.filter(
    (y) => y.depleted === false
  ).length;

  const lastYear = projectionResult.yearByYear[projectionResult.yearByYear.length - 1];
  const summary = projectionResult.summary;

  const label = input.label ?? input.config.label ?? `${input.config.strategyType} / ${input.config.orderingType}`;

  // 10. Persist to DB
  const run = await prisma.withdrawalStrategyRun.create({
    data: {
      householdId: input.householdId,
      scenarioId: input.scenarioId,
      label,
      strategyType: input.config.strategyType,
      orderingType: input.config.orderingType,
      configJson: JSON.parse(JSON.stringify(input.config)) as Prisma.InputJsonValue,
      snapshotJson: JSON.parse(JSON.stringify(effectiveSnapshot)) as Prisma.InputJsonValue,
      summaryJson: JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue,
      yearlyJson: JSON.parse(JSON.stringify(yearByYear)) as Prisma.InputJsonValue,
      success: summary.success,
      firstDepletionYear: summary.firstDepletionYear,
      endingAssets: summary.endingBalance,
      totalWithdrawals: summary.totalWithdrawals,
      totalTaxes: summary.totalTaxes,
      isStressRun: input.isStressRun ?? false,
      stressPathId: input.stressPathId ?? null,
      projectionStartYear: summary.projectionStartYear,
      projectionEndYear: summary.projectionEndYear,
    },
  });

  return {
    runId: run.id,
    householdId: input.householdId,
    scenarioId: input.scenarioId,
    scenarioName: scenario.name,
    config: input.config,
    label,
    createdAt: run.createdAt.toISOString(),
    isStressRun: input.isStressRun ?? false,
    stressPathId: input.stressPathId ?? null,
    success: summary.success,
    firstDepletionYear: summary.firstDepletionYear,
    firstRetirementYear: summary.firstRetirementYear,
    endingAssets: Number(run.endingAssets),
    endingNetWorth: lastYear?.netWorth ?? 0,
    totalWithdrawals: Number(run.totalWithdrawals),
    totalTaxes: Number(run.totalTaxes),
    averageAnnualWithdrawal,
    maxAnnualWithdrawal,
    yearsFullyFunded,
    projectionStartYear: summary.projectionStartYear,
    projectionEndYear: summary.projectionEndYear,
    yearByYear,
  };
}

// ---------------------------------------------------------------------------
// List and get
// ---------------------------------------------------------------------------

export async function listWithdrawalStrategyRuns(
  householdId: string,
  includeStressRuns = false
): Promise<WithdrawalStrategySummaryItem[]> {
  const runs = await prisma.withdrawalStrategyRun.findMany({
    where: {
      householdId,
      ...(includeStressRuns ? {} : { isStressRun: false }),
    },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  });

  return runs.map((r) => ({
    runId: r.id,
    scenarioName: r.scenario?.name ?? 'Unknown scenario',
    strategyType: r.strategyType as WithdrawalStrategySummaryItem['strategyType'],
    orderingType: r.orderingType as WithdrawalStrategySummaryItem['orderingType'],
    label: r.label ?? r.strategyType,
    success: r.success,
    firstDepletionYear: r.firstDepletionYear,
    endingAssets: Number(r.endingAssets),
    totalWithdrawals: Number(r.totalWithdrawals),
    isStressRun: r.isStressRun,
    stressPathId: r.stressPathId,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getWithdrawalStrategyRun(
  runId: string,
  householdId: string
): Promise<WithdrawalStrategyRunResult | null> {
  const run = await prisma.withdrawalStrategyRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });

  if (!run) return null;

  const config = run.configJson as unknown as WithdrawalStrategyRunResult['config'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = run.summaryJson as any;
  const yearByYear = run.yearlyJson as unknown as WithdrawalYearResult[];

  const retirementYears = yearByYear.filter((y) => y.requestedWithdrawal > 0 || y.actualWithdrawal > 0);
  const retirementActual = retirementYears.map((y) => y.actualWithdrawal);
  const averageAnnualWithdrawal =
    retirementActual.length > 0
      ? retirementActual.reduce((s, v) => s + v, 0) / retirementActual.length
      : 0;
  const maxAnnualWithdrawal = retirementActual.length > 0 ? Math.max(...retirementActual) : 0;
  const yearsFullyFunded = yearByYear.filter((y) => !y.depleted).length;
  const lastYear = yearByYear[yearByYear.length - 1];

  return {
    runId: run.id,
    householdId: run.householdId,
    scenarioId: run.scenarioId ?? '',
    scenarioName: run.scenario?.name ?? 'Unknown scenario',
    config,
    label: run.label ?? run.strategyType,
    createdAt: run.createdAt.toISOString(),
    isStressRun: run.isStressRun,
    stressPathId: run.stressPathId,
    success: run.success,
    firstDepletionYear: run.firstDepletionYear,
    firstRetirementYear: summary?.firstRetirementYear ?? null,
    endingAssets: Number(run.endingAssets),
    endingNetWorth: lastYear?.endingAssets ?? 0,
    totalWithdrawals: Number(run.totalWithdrawals),
    totalTaxes: Number(run.totalTaxes),
    averageAnnualWithdrawal,
    maxAnnualWithdrawal,
    yearsFullyFunded,
    projectionStartYear: run.projectionStartYear,
    projectionEndYear: run.projectionEndYear,
    yearByYear,
  };
}
