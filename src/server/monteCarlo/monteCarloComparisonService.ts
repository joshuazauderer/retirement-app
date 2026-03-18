/**
 * Compare two persisted Monte Carlo runs.
 * Computes probability deltas, percentile outcome deltas, and assumption diffs.
 */

import { monteCarloRunService } from './monteCarloRunService';
import type { MonteCarloComparisonResult, MonteCarloRunResult } from './types';

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function usd(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}
function delta(a: number, b: number, higherIsBetter: boolean): {
  delta: string;
  direction: 'better' | 'worse' | 'neutral';
} {
  const diff = b - a;
  const sign = diff > 0 ? '+' : '';
  const isZero = Math.abs(diff) < 0.0001;
  const direction = isZero
    ? 'neutral'
    : (higherIsBetter ? diff > 0 : diff < 0)
    ? 'better'
    : 'worse';
  return { delta: isZero ? '—' : `${sign}${Math.round(diff).toLocaleString()}`, direction };
}

export async function compareMonteCarloRuns(
  runIdA: string,
  runIdB: string,
  householdId: string
): Promise<MonteCarloComparisonResult> {
  const [runA, runB] = await Promise.all([
    monteCarloRunService.getById(runIdA, householdId),
    monteCarloRunService.getById(runIdB, householdId),
  ]);
  if (!runA) throw new Error('Run A not found.');
  if (!runB) throw new Error('Run B not found.');

  const agg = (r: MonteCarloRunResult) => r.aggregation;

  const successDelta = agg(runB).success.successProbability - agg(runA).success.successProbability;
  const failureDelta = agg(runB).success.failureProbability - agg(runA).success.failureProbability;
  const medianDelta = agg(runB).endingAssets.p50 - agg(runA).endingAssets.p50;
  const p10Delta = agg(runB).endingAssets.p10 - agg(runA).endingAssets.p10;
  const p90Delta = agg(runB).endingAssets.p90 - agg(runA).endingAssets.p90;

  const depletionYearA = agg(runA).success.medianDepletionYear;
  const depletionYearB = agg(runB).success.medianDepletionYear;
  const medianDepletionYearDelta =
    depletionYearA != null && depletionYearB != null
      ? depletionYearB - depletionYearA
      : null;

  // Assumption diffs
  const assumptionDiffs: MonteCarloComparisonResult['assumptionDiffs'] = [];
  const aA = runA.assumptions;
  const aB = runB.assumptions;

  if (Math.abs(aA.meanReturn - aB.meanReturn) > 0.0001) {
    assumptionDiffs.push({ label: 'Mean Return', a: pct(aA.meanReturn), b: pct(aB.meanReturn) });
  }
  if (Math.abs(aA.volatility - aB.volatility) > 0.0001) {
    assumptionDiffs.push({ label: 'Volatility', a: pct(aA.volatility), b: pct(aB.volatility) });
  }
  if (Math.abs(aA.inflationRate - aB.inflationRate) > 0.0001) {
    assumptionDiffs.push({ label: 'Inflation Rate', a: pct(aA.inflationRate), b: pct(aB.inflationRate) });
  }
  if (runA.scenarioId !== runB.scenarioId) {
    assumptionDiffs.push({ label: 'Scenario', a: runA.scenarioName, b: runB.scenarioName });
  }
  if (aA.simulationCount !== aB.simulationCount) {
    assumptionDiffs.push({ label: 'Simulation Count', a: String(aA.simulationCount), b: String(aB.simulationCount) });
  }

  // Outcome diffs
  const outcomeDiffs: MonteCarloComparisonResult['outcomeDiffs'] = [
    {
      label: 'Success Probability',
      a: pct(agg(runA).success.successProbability),
      b: pct(agg(runB).success.successProbability),
      ...(() => {
        const sign = successDelta > 0 ? '+' : '';
        const d = `${sign}${(successDelta * 100).toFixed(1)}%`;
        const direction = Math.abs(successDelta) < 0.001 ? 'neutral' : successDelta > 0 ? 'better' : 'worse';
        return { delta: d, direction };
      })(),
    },
    {
      label: 'Median Ending Assets',
      a: usd(agg(runA).endingAssets.p50),
      b: usd(agg(runB).endingAssets.p50),
      ...delta(agg(runA).endingAssets.p50, agg(runB).endingAssets.p50, true),
    },
    {
      label: 'P10 Ending Assets (Worst Case)',
      a: usd(agg(runA).endingAssets.p10),
      b: usd(agg(runB).endingAssets.p10),
      ...delta(agg(runA).endingAssets.p10, agg(runB).endingAssets.p10, true),
    },
    {
      label: 'P90 Ending Assets (Best Case)',
      a: usd(agg(runA).endingAssets.p90),
      b: usd(agg(runB).endingAssets.p90),
      ...delta(agg(runA).endingAssets.p90, agg(runB).endingAssets.p90, true),
    },
  ];

  if (depletionYearA || depletionYearB) {
    outcomeDiffs.push({
      label: 'Median Depletion Year',
      a: depletionYearA?.toString() ?? 'None',
      b: depletionYearB?.toString() ?? 'None',
      delta: medianDepletionYearDelta != null
        ? (medianDepletionYearDelta > 0 ? `+${medianDepletionYearDelta}yr` : `${medianDepletionYearDelta}yr`)
        : '—',
      direction: medianDepletionYearDelta == null
        ? 'neutral'
        : medianDepletionYearDelta > 0
        ? 'better'
        : 'worse',
    });
  }

  return {
    runA,
    runB,
    successProbabilityDelta: successDelta,
    failureProbabilityDelta: failureDelta,
    medianEndingAssetsDelta: medianDelta,
    p10EndingAssetsDelta: p10Delta,
    p90EndingAssetsDelta: p90Delta,
    medianDepletionYearDelta,
    assumptionDiffs,
    outcomeDiffs,
  };
}
