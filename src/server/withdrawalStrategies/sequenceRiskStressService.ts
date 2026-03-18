/**
 * Sequence Risk Stress Service — Phase 7
 *
 * Runs targeted deterministic stress paths to help users understand
 * sequence-of-returns risk: early poor returns cause disproportionate
 * long-term damage because withdrawals occur while balances are depressed.
 *
 * Stress paths are predefined here and expressed as sparse return vectors
 * relative to the projection start year (not the retirement year). Null entries
 * use the baseline expected return. Parameters live in code (not page components).
 *
 * v1 limitations:
 * - Stress paths are deterministic overrides, not stochastic (not Monte Carlo paths).
 * - Return vectors are relative to projection start, not retirement year.
 * - Only the baseline ordering and policy apply; per-path ordering changes not supported.
 */

import type {
  StressPath,
  WithdrawalStrategyRunInput,
  WithdrawalStrategyRunResult,
  SequenceRiskStressResult,
  SequenceRiskRunResult,
} from './types';
import { runWithdrawalStrategy } from './withdrawalStrategyService';
import { getWithdrawalStrategyRun } from './withdrawalStrategyService';

// ---------------------------------------------------------------------------
// Pre-defined stress paths
// ---------------------------------------------------------------------------

/**
 * All stress paths are expressed as sparse return vectors from the
 * projection start year (year 0 = first simulation year).
 *
 * The intent is to inject bad returns at or just after retirement start.
 * Because the projection may run for years before retirement, the first
 * few non-null overrides in a path affect pre-retirement years too — which
 * is acceptable since we document this is a v1 approximation. The sequence
 * risk becomes apparent when the early overrides hit early retirement.
 *
 * In practice users will configure a scenario where retirement starts soon,
 * making the early-year effect more prominent.
 */
export const STRESS_PATHS: StressPath[] = [
  {
    id: 'early_crash',
    label: 'Early Crash',
    description:
      'Severe bear market immediately at retirement: -20%, -10%, 0% in the first three years, then baseline returns.',
    annualReturnOverrides: [-0.20, -0.10, 0.00], // null for subsequent years (baseline)
  },
  {
    id: 'mild_early_weakness',
    label: 'Mild Early Weakness',
    description:
      'Mild headwinds in early retirement: -10%, -5%, +2% in the first three years, then baseline returns.',
    annualReturnOverrides: [-0.10, -0.05, 0.02],
  },
  {
    id: 'delayed_crash',
    label: 'Delayed Crash',
    description:
      'Normal returns for five years, then a sharp market downturn of -25%, -10% in years 6–7.',
    annualReturnOverrides: [null, null, null, null, null, -0.25, -0.10],
  },
  {
    id: 'double_dip',
    label: 'Double Dip',
    description:
      'Two distinct bear markets: -15% in year 1, partial recovery in years 2-4, then -20% in year 5.',
    annualReturnOverrides: [-0.15, 0.05, 0.05, 0.05, -0.20],
  },
  {
    id: 'lost_decade',
    label: 'Lost Decade',
    description:
      'Flat to slightly negative returns for ten years simulating a prolonged low-return environment.',
    annualReturnOverrides: [
      -0.05, 0.01, -0.03, 0.02, -0.02,
      0.01, -0.04, 0.02, -0.01, 0.00,
    ],
  },
];

export function getStressPath(id: string): StressPath | undefined {
  return STRESS_PATHS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Sequence risk analysis runner
// ---------------------------------------------------------------------------

/**
 * Runs the baseline strategy + all requested stress paths, then returns
 * a comparison showing how sequence risk affects outcomes.
 *
 * @param baselineRunId  Optional: if the baseline was already persisted, pass
 *                       its runId to avoid re-running it.
 * @param input          Strategy input (scenario + config). Used for both
 *                       baseline and stress runs.
 * @param stressPathIds  Subset of STRESS_PATHS IDs to run. Defaults to all.
 */
export async function runSequenceRiskAnalysis(
  input: WithdrawalStrategyRunInput,
  stressPathIds?: string[],
  existingBaselineRunId?: string
): Promise<SequenceRiskStressResult> {
  // 1. Run (or load) baseline
  let baseline: WithdrawalStrategyRunResult;
  if (existingBaselineRunId) {
    const loaded = await getWithdrawalStrategyRun(
      existingBaselineRunId,
      input.householdId
    );
    if (!loaded) throw new Error('Baseline run not found.');
    baseline = loaded;
  } else {
    baseline = await runWithdrawalStrategy({
      ...input,
      annualReturnOverrides: undefined,
      isStressRun: false,
      label: input.label ?? 'Baseline',
    });
  }

  // 2. Determine which paths to run
  const paths =
    stressPathIds && stressPathIds.length > 0
      ? STRESS_PATHS.filter((p) => stressPathIds.includes(p.id))
      : STRESS_PATHS;

  // 3. Run each stress path
  const stressResults: SequenceRiskRunResult[] = [];
  for (const path of paths) {
    const stressResult = await runWithdrawalStrategy({
      ...input,
      annualReturnOverrides: path.annualReturnOverrides,
      isStressRun: true,
      stressPathId: path.id,
      label: `${input.label ?? input.config.strategyType} — ${path.label}`,
    });

    const depletionYearDelta =
      stressResult.firstDepletionYear !== null && baseline.firstDepletionYear !== null
        ? stressResult.firstDepletionYear - baseline.firstDepletionYear
        : stressResult.firstDepletionYear !== null && baseline.firstDepletionYear === null
        ? 0 // stress depletes, baseline doesn't — delta is meaningfully bad
        : null;

    const endingAssetDelta = stressResult.endingAssets - baseline.endingAssets;

    // Years where stress has shortfall but baseline doesn't
    const baselineShortfallByYear = new Map(
      baseline.yearByYear.map((y) => [y.year, y.shortfall])
    );
    const vulnerableYears = stressResult.yearByYear
      .filter(
        (y) =>
          y.shortfall > 0 &&
          (baselineShortfallByYear.get(y.year) ?? 0) === 0
      )
      .map((y) => y.year);

    stressResults.push({
      stressPath: path,
      result: stressResult,
      depletionYearDelta,
      endingAssetDelta,
      vulnerableYears,
    });
  }

  return { baseline, stressResults };
}
