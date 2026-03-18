/**
 * Aggregation layer: converts raw path summaries into percentile statistics,
 * balance bands, success metrics, and chart-ready data.
 */

import type {
  MonteCarloPathSummary,
  MonteCarloAggregationResult,
  MonteCarloAssumptions,
  MonteCarloPercentileSeries,
  MonteCarloSuccessSummary,
  MonteCarloEndingAssetStats,
} from './types';
import type { NormalizedMember } from '@/server/simulation/types';

/** Sort an array numerically and return the value at a given percentile (0–100). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

/** Median of an unsorted array (makes a copy before sorting). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return percentile(s, 50);
}

function fmtStats(values: number[]): MonteCarloEndingAssetStats {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    mean: sorted.length > 0 ? sum / sorted.length : 0,
  };
}

/**
 * Determine the birth year of the primary member for age-based depletion thresholds.
 * Returns null if no primary member is found.
 */
function getPrimaryMemberBirthYear(members: NormalizedMember[]): number | null {
  const primary = members.find(m => m.isPrimary) ?? members[0] ?? null;
  if (!primary) return null;
  return parseInt(primary.dateOfBirth.slice(0, 4), 10);
}

export function aggregatePaths(
  paths: MonteCarloPathSummary[],
  assumptions: MonteCarloAssumptions,
  projectionStartYear: number,
  projectionEndYear: number,
  members: NormalizedMember[]
): MonteCarloAggregationResult {
  const total = paths.length;
  const successPaths = paths.filter(p => p.success);
  const failurePaths = paths.filter(p => !p.success);

  // ---- Success metrics ----
  const successCount = successPaths.length;
  const failureCount = failurePaths.length;
  const successProbability = total > 0 ? successCount / total : 0;
  const failureProbability = 1 - successProbability;

  // Age-based depletion probabilities
  const primaryBirthYear = getPrimaryMemberBirthYear(members);
  const depletionBeforeAge = (targetAge: number): number => {
    if (!primaryBirthYear || failureCount === 0) return 0;
    const cutoffYear = primaryBirthYear + targetAge;
    const before = failurePaths.filter(
      p => p.firstDepletionYear != null && p.firstDepletionYear <= cutoffYear
    ).length;
    return before / total;
  };

  const depletionYears = failurePaths
    .map(p => p.firstDepletionYear)
    .filter((y): y is number => y != null)
    .sort((a, b) => a - b);

  const medianDepletionYear =
    depletionYears.length > 0 ? percentile(depletionYears, 50) : null;

  const successSummary: MonteCarloSuccessSummary = {
    successProbability,
    failureProbability,
    depletionBeforeAge85Probability: depletionBeforeAge(85),
    depletionBeforeAge90Probability: depletionBeforeAge(90),
    depletionBeforeAge95Probability: depletionBeforeAge(95),
    medianDepletionYear,
    successCount,
    failureCount,
    totalPaths: total,
  };

  // ---- Ending asset / net-worth stats ----
  const endingAssetsStats = fmtStats(paths.map(p => p.endingAssets));

  const nwSorted = [...paths.map(p => p.endingNetWorth)].sort((a, b) => a - b);
  const endingNetWorth = {
    p10: percentile(nwSorted, 10),
    p25: percentile(nwSorted, 25),
    p50: percentile(nwSorted, 50),
    p75: percentile(nwSorted, 75),
    p90: percentile(nwSorted, 90),
  };

  // ---- Year-by-year percentile balance bands ----
  const horizonYears = projectionEndYear - projectionStartYear + 1;
  const years: number[] = [];
  for (let y = projectionStartYear; y <= projectionEndYear; y++) years.push(y);

  const balanceBands: MonteCarloPercentileSeries = {
    years,
    p10: [],
    p25: [],
    p50: [],
    p75: [],
    p90: [],
  };

  for (let i = 0; i < horizonYears; i++) {
    const yearValues = paths
      .map(p => (i < p.yearlyAssets.length ? p.yearlyAssets[i] : 0))
      .sort((a, b) => a - b);
    balanceBands.p10.push(percentile(yearValues, 10));
    balanceBands.p25.push(percentile(yearValues, 25));
    balanceBands.p50.push(percentile(yearValues, 50));
    balanceBands.p75.push(percentile(yearValues, 75));
    balanceBands.p90.push(percentile(yearValues, 90));
  }

  // ---- Depletion histogram ----
  const depletionCounts: Record<number, number> = {};
  for (const y of depletionYears) {
    depletionCounts[y] = (depletionCounts[y] ?? 0) + 1;
  }
  let cumulative = 0;
  const depletionHistogram = Object.entries(depletionCounts)
    .map(([yr, cnt]) => ({ year: Number(yr), count: cnt }))
    .sort((a, b) => a.year - b.year)
    .map(({ year, count }) => {
      cumulative += count;
      return { year, count, cumulativePct: total > 0 ? cumulative / total : 0 };
    });

  return {
    assumptions,
    success: successSummary,
    endingAssets: endingAssetsStats,
    endingNetWorth,
    balanceBands,
    depletionHistogram,
    projectionStartYear,
    projectionEndYear,
  };
}
