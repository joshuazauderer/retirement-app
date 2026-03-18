/**
 * Monte Carlo projection engine.
 *
 * Runs N simulated paths by injecting stochastic return vectors into the
 * existing deterministic cash-flow engine (runDeterministicProjection).
 * This reuses all cash-flow ordering, withdrawal logic, and tax modeling
 * from Phase 3 exactly — the only difference per path is the return sequence.
 */

import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import { generateAllReturnPaths } from './randomPathService';
import type { SimulationSnapshot } from '@/server/simulation/types';
import type { MonteCarloAssumptions, MonteCarloPathSummary } from './types';

/**
 * Run all Monte Carlo paths against the given effective snapshot.
 * Returns compact per-path summaries (not full year-by-year data per path).
 *
 * Performance note: 1000 paths × ~40 years = ~40k iterations.
 * Each iteration is a single pass of the deterministic engine year loop.
 * For the target VPS (Hostinger), this runs synchronously in well under 5s.
 */
export function runMonteCarloPaths(
  snapshot: SimulationSnapshot,
  assumptions: MonteCarloAssumptions
): MonteCarloPathSummary[] {
  const { seed, simulationCount, meanReturn, volatility } = assumptions;

  const horizonYears =
    snapshot.timeline.projectionEndYear - snapshot.timeline.simulationYearStart + 1;

  // Generate all return paths up front with a single seeded RNG pass
  const returnPaths = generateAllReturnPaths(
    seed,
    simulationCount,
    meanReturn,
    volatility,
    horizonYears
  );

  const summaries: MonteCarloPathSummary[] = [];

  for (let i = 0; i < simulationCount; i++) {
    const result = runDeterministicProjection(snapshot, { annualReturns: returnPaths[i] });
    const { summary, yearByYear } = result;

    summaries.push({
      pathIndex: i,
      success: summary.success,
      firstDepletionYear: summary.firstDepletionYear,
      endingAssets: summary.endingBalance,
      endingNetWorth: summary.endingNetWorth,
      totalWithdrawals: summary.totalWithdrawals,
      totalTaxes: summary.totalTaxes,
      yearlyAssets: yearByYear.map(y => y.endingTotalAssets),
    });
  }

  return summaries;
}
