// ============================================================
// Phase 6 — Monte Carlo Simulation Engine Types
//
// Limitations (v1):
// - Annual time-step model only (no monthly granularity)
// - Normal return distribution assumption (no fat tails/regime switching)
// - Single portfolio-level return per year (no per-account allocation)
// - Independent annual draws (no autocorrelation)
// - Deterministic inflation (stochastic inflation is a future extension)
// ============================================================

export interface MonteCarloAssumptions {
  /** Mean annual portfolio return (decimal, e.g. 0.07 = 7%) */
  meanReturn: number;
  /** Annual portfolio volatility / standard deviation (decimal, e.g. 0.12 = 12%) */
  volatility: number;
  /** Deterministic inflation rate used across all paths */
  inflationRate: number;
  /** Effective tax rate used across all paths */
  taxRate: number;
  /** Random seed — same seed + same inputs = identical output */
  seed: number;
  /** Number of simulated paths */
  simulationCount: number;
  /** Engine version for future compatibility */
  engineVersion: string;
}

export interface MonteCarloPathSummary {
  pathIndex: number;
  success: boolean;
  firstDepletionYear: number | null;
  endingAssets: number;
  endingNetWorth: number;
  totalWithdrawals: number;
  totalTaxes: number;
  /** Ending financial assets for each projected year (index 0 = first year) */
  yearlyAssets: number[];
}

export interface MonteCarloPercentileSeries {
  /** Calendar years */
  years: number[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

export interface MonteCarloSuccessSummary {
  successProbability: number;
  failureProbability: number;
  depletionBeforeAge85Probability: number;
  depletionBeforeAge90Probability: number;
  depletionBeforeAge95Probability: number;
  /** Median depletion year among failed paths, null if no failures */
  medianDepletionYear: number | null;
  successCount: number;
  failureCount: number;
  totalPaths: number;
}

export interface MonteCarloEndingAssetStats {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface MonteCarloAggregationResult {
  assumptions: MonteCarloAssumptions;
  success: MonteCarloSuccessSummary;
  endingAssets: MonteCarloEndingAssetStats;
  endingNetWorth: { p10: number; p25: number; p50: number; p75: number; p90: number };
  /** Chart-ready percentile bands for portfolio balance over time */
  balanceBands: MonteCarloPercentileSeries;
  /** Failure year histogram: how many paths depleted in each calendar year */
  depletionHistogram: Array<{ year: number; count: number; cumulativePct: number }>;
  projectionStartYear: number;
  projectionEndYear: number;
}

export interface MonteCarloRunResult {
  runId: string;
  householdId: string;
  scenarioId: string | null;
  scenarioName: string;
  label: string | null;
  seed: number;
  simulationCount: number;
  engineVersion: string;
  assumptions: MonteCarloAssumptions;
  aggregation: MonteCarloAggregationResult;
  createdAt: string;
}

export interface MonteCarloRunInput {
  householdId: string;
  scenarioId: string;
  simulationCount?: number;
  seed?: number;
  /** Override mean return (decimal). Defaults to planning assumptions value. */
  meanReturnOverride?: number;
  /** Override volatility (decimal). Defaults to planning assumptions value. */
  volatilityOverride?: number;
}

/** Validation bounds for Monte Carlo inputs */
export const MC_BOUNDS = {
  MIN_SIMULATION_COUNT: 100,
  MAX_SIMULATION_COUNT: 5000,
  DEFAULT_SIMULATION_COUNT: 1000,
  DEFAULT_VOLATILITY: 0.12,
  ENGINE_VERSION: '1.0.0',
  /** Clamp sampled returns: floor prevents catastrophic single-year wipeouts */
  RETURN_FLOOR: -0.5,
  RETURN_CAP: 1.0,
} as const;

export interface MonteCarloComparisonResult {
  runA: MonteCarloRunResult;
  runB: MonteCarloRunResult;
  successProbabilityDelta: number;
  failureProbabilityDelta: number;
  medianEndingAssetsDelta: number;
  p10EndingAssetsDelta: number;
  p90EndingAssetsDelta: number;
  medianDepletionYearDelta: number | null;
  assumptionDiffs: Array<{ label: string; a: string; b: string }>;
  outcomeDiffs: Array<{
    label: string;
    a: string;
    b: string;
    delta: string;
    direction: 'better' | 'worse' | 'neutral';
  }>;
}

export interface MonteCarloListItem {
  runId: string;
  label: string | null;
  scenarioId: string | null;
  scenarioName: string;
  simulationCount: number;
  seed: number;
  successProbability: number;
  medianEndingAssets: number;
  projectionStartYear: number;
  projectionEndYear: number;
  createdAt: string;
}
