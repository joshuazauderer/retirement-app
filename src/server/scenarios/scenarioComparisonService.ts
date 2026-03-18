import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '@/server/simulation/buildSimulationSnapshot';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import { mergeScenarioOverrides, buildAssumptionDiffs } from './scenarioSnapshotMergeService';
import { computeRetirementReadiness } from '@/server/calculators/retirementReadinessService';
import type { ScenarioComparisonResult, ScenarioOverridePayload } from './types';
import type { SimulationSnapshot } from '@/server/simulation/types';

function directionFor(label: string, delta: number): 'better' | 'worse' | 'neutral' {
  if (delta === 0) return 'neutral';

  if (label.includes('Ending Balance') || label.includes('Net Worth') || label.includes('Years Funded')) {
    return delta > 0 ? 'better' : 'worse';
  }
  if (label.includes('Total Withdrawals') || label.includes('Total Taxes')) {
    return delta < 0 ? 'better' : 'worse';
  }
  if (label.includes('Depletion')) {
    return delta > 0 ? 'better' : 'worse';
  }
  return delta > 0 ? 'better' : 'neutral';
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

async function runForScenario(scenarioId: string, householdId: string, baselineSnapshot: SimulationSnapshot) {
  const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, householdId } });
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found`);

  const overrides = scenario.overridesJson as ScenarioOverridePayload | null;
  const effectiveSnapshot = mergeScenarioOverrides(baselineSnapshot, overrides, scenarioId, scenario.name);
  const result = runDeterministicProjection(effectiveSnapshot);
  const readiness = computeRetirementReadiness(effectiveSnapshot, result);

  return {
    scenario,
    effectiveSnapshot,
    result,
    readiness,
  };
}

export const scenarioComparisonService = {
  async compare(
    scenarioAId: string,
    scenarioBId: string,
    householdId: string
  ): Promise<ScenarioComparisonResult> {
    // Build shared baseline once
    const baselineSnapshot = await buildSimulationSnapshot(householdId, prisma);

    const [dataA, dataB] = await Promise.all([
      runForScenario(scenarioAId, householdId, baselineSnapshot),
      runForScenario(scenarioBId, householdId, baselineSnapshot),
    ]);

    const summaryA = dataA.result.summary;
    const summaryB = dataB.result.summary;
    const readinessA = dataA.readiness;
    const readinessB = dataB.readiness;

    // Build assumption diffs (what changed from A to B)
    const assumptionDiffs = buildAssumptionDiffs(
      dataA.effectiveSnapshot,
      dataB.effectiveSnapshot,
      dataB.scenario.overridesJson as ScenarioOverridePayload | null
    );

    // Build outcome diffs
    const endingBalanceDelta = summaryB.endingBalance - summaryA.endingBalance;
    const netWorthDelta = summaryB.endingNetWorth - summaryA.endingNetWorth;
    const withdrawalsDelta = summaryB.totalWithdrawals - summaryA.totalWithdrawals;
    const taxesDelta = summaryB.totalTaxes - summaryA.totalTaxes;
    const yearsFundedDelta = readinessB.yearsFullyFunded - readinessA.yearsFullyFunded;
    const depletionDelta = summaryB.firstDepletionYear !== null && summaryA.firstDepletionYear !== null
      ? summaryB.firstDepletionYear - summaryA.firstDepletionYear : 0;

    const outcomeDiffs: ScenarioComparisonResult['outcomeDiffs'] = [
      { label: 'Ending Balance', baseline: fmt(summaryA.endingBalance), scenario: fmt(summaryB.endingBalance), delta: `${endingBalanceDelta >= 0 ? '+' : ''}${fmt(endingBalanceDelta)}`, direction: directionFor('Ending Balance', endingBalanceDelta) },
      { label: 'Ending Net Worth', baseline: fmt(summaryA.endingNetWorth), scenario: fmt(summaryB.endingNetWorth), delta: `${netWorthDelta >= 0 ? '+' : ''}${fmt(netWorthDelta)}`, direction: directionFor('Ending Net Worth', netWorthDelta) },
      { label: 'Total Withdrawals', baseline: fmt(summaryA.totalWithdrawals), scenario: fmt(summaryB.totalWithdrawals), delta: `${withdrawalsDelta >= 0 ? '+' : ''}${fmt(withdrawalsDelta)}`, direction: directionFor('Total Withdrawals', withdrawalsDelta) },
      { label: 'Total Taxes', baseline: fmt(summaryA.totalTaxes), scenario: fmt(summaryB.totalTaxes), delta: `${taxesDelta >= 0 ? '+' : ''}${fmt(taxesDelta)}`, direction: directionFor('Total Taxes', taxesDelta) },
      { label: 'Years Funded', baseline: readinessA.yearsFullyFunded.toString(), scenario: readinessB.yearsFullyFunded.toString(), delta: `${yearsFundedDelta >= 0 ? '+' : ''}${yearsFundedDelta}`, direction: directionFor('Years Funded', yearsFundedDelta) },
      {
        label: 'First Depletion Year',
        baseline: summaryA.firstDepletionYear?.toString() ?? 'None',
        scenario: summaryB.firstDepletionYear?.toString() ?? 'None',
        delta: summaryA.firstDepletionYear === null && summaryB.firstDepletionYear === null
          ? 'No change'
          : depletionDelta !== 0 ? `${depletionDelta > 0 ? '+' : ''}${depletionDelta} yrs` : 'No change',
        direction: summaryA.firstDepletionYear === null && summaryB.firstDepletionYear === null
          ? 'neutral'
          : directionFor('Depletion', depletionDelta),
      },
    ];

    const slimYears = (yearByYear: ReturnType<typeof runDeterministicProjection>['yearByYear']) =>
      yearByYear.map(y => ({
        year: y.year,
        endingTotalAssets: y.endingTotalAssets,
        totalIncome: y.earnedIncome + y.benefitsIncome,
        expenses: y.expenses,
        actualWithdrawal: y.actualWithdrawal,
      }));

    return {
      scenarioA: {
        id: dataA.scenario.id,
        name: dataA.scenario.name,
        isBaseline: dataA.scenario.isBaseline,
        readinessStatus: readinessA.status,
        success: summaryA.success,
        firstDepletionYear: summaryA.firstDepletionYear,
        endingBalance: summaryA.endingBalance,
        endingNetWorth: summaryA.endingNetWorth,
        totalWithdrawals: summaryA.totalWithdrawals,
        totalTaxes: summaryA.totalTaxes,
        yearsFullyFunded: readinessA.yearsFullyFunded,
        yearsProjected: summaryA.yearsProjected,
        firstRetirementYear: summaryA.firstRetirementYear,
        projectionStartYear: summaryA.projectionStartYear,
        projectionEndYear: summaryA.projectionEndYear,
        yearByYear: slimYears(dataA.result.yearByYear),
      },
      scenarioB: {
        id: dataB.scenario.id,
        name: dataB.scenario.name,
        isBaseline: dataB.scenario.isBaseline,
        readinessStatus: readinessB.status,
        success: summaryB.success,
        firstDepletionYear: summaryB.firstDepletionYear,
        endingBalance: summaryB.endingBalance,
        endingNetWorth: summaryB.endingNetWorth,
        totalWithdrawals: summaryB.totalWithdrawals,
        totalTaxes: summaryB.totalTaxes,
        yearsFullyFunded: readinessB.yearsFullyFunded,
        yearsProjected: summaryB.yearsProjected,
        firstRetirementYear: summaryB.firstRetirementYear,
        projectionStartYear: summaryB.projectionStartYear,
        projectionEndYear: summaryB.projectionEndYear,
        yearByYear: slimYears(dataB.result.yearByYear),
      },
      assumptionDiffs,
      outcomeDiffs,
    };
  },
};
