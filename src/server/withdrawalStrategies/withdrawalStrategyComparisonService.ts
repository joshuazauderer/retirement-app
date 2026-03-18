/**
 * Withdrawal Strategy Comparison Service — Phase 7
 *
 * Compares two persisted withdrawal strategy runs side-by-side, computing
 * configuration differences and outcome deltas.
 *
 * Comparisons are derived views (not persisted). They are computed on demand
 * from persisted run records.
 */

import { getWithdrawalStrategyRun } from './withdrawalStrategyService';
import type {
  WithdrawalStrategyComparisonResult,
  WithdrawalStrategyRunResult,
  WithdrawalOrderingType,
  WithdrawalStrategyType,
} from './types';
import { strategyTypeLabel } from './withdrawalPolicyEngine';
import { orderingTypeLabel } from './withdrawalOrderingService';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString();

export async function compareWithdrawalStrategyRuns(
  runIdA: string,
  runIdB: string,
  householdId: string
): Promise<WithdrawalStrategyComparisonResult> {
  const [runA, runB] = await Promise.all([
    getWithdrawalStrategyRun(runIdA, householdId),
    getWithdrawalStrategyRun(runIdB, householdId),
  ]);

  if (!runA) throw new Error(`Run A (${runIdA}) not found.`);
  if (!runB) throw new Error(`Run B (${runIdB}) not found.`);

  const configDiffs = buildConfigDiffs(runA, runB);
  const outcomeDiffs = buildOutcomeDiffs(runA, runB);

  return { runA, runB, configDiffs, outcomeDiffs };
}

// ---------------------------------------------------------------------------
// Diff builders
// ---------------------------------------------------------------------------

function buildConfigDiffs(
  a: WithdrawalStrategyRunResult,
  b: WithdrawalStrategyRunResult
): WithdrawalStrategyComparisonResult['configDiffs'] {
  const diffs: WithdrawalStrategyComparisonResult['configDiffs'] = [];

  const aLabel = strategyTypeLabel(a.config.strategyType);
  const bLabel = strategyTypeLabel(b.config.strategyType);
  if (aLabel !== bLabel) {
    diffs.push({ label: 'Withdrawal Strategy', a: aLabel, b: bLabel });
  }

  const aOrdering = orderingTypeLabel(a.config.orderingType);
  const bOrdering = orderingTypeLabel(b.config.orderingType);
  if (aOrdering !== bOrdering) {
    diffs.push({ label: 'Account Ordering', a: aOrdering, b: bOrdering });
  }

  // Fixed target differences
  if (
    (a.config.strategyType === 'FIXED_NOMINAL' || a.config.strategyType === 'FIXED_REAL') &&
    (b.config.strategyType === 'FIXED_NOMINAL' || b.config.strategyType === 'FIXED_REAL')
  ) {
    const aTarget = fmt(a.config.annualWithdrawalTarget ?? 0);
    const bTarget = fmt(b.config.annualWithdrawalTarget ?? 0);
    if (aTarget !== bTarget) {
      diffs.push({ label: 'Annual Withdrawal Target', a: aTarget, b: bTarget });
    }
  }

  // Guardrail differences
  if (a.config.strategyType === 'GUARDRAIL' && b.config.strategyType === 'GUARDRAIL') {
    const ag = a.config.guardrailConfig;
    const bg = b.config.guardrailConfig;
    if (ag && bg) {
      if (ag.initialAnnualWithdrawal !== bg.initialAnnualWithdrawal) {
        diffs.push({
          label: 'Guardrail Initial Withdrawal',
          a: fmt(ag.initialAnnualWithdrawal),
          b: fmt(bg.initialAnnualWithdrawal),
        });
      }
      if (ag.lowerGuardrailPct !== bg.lowerGuardrailPct) {
        diffs.push({
          label: 'Lower Guardrail',
          a: pct(ag.lowerGuardrailPct),
          b: pct(bg.lowerGuardrailPct),
        });
      }
      if (ag.decreaseStepPct !== bg.decreaseStepPct) {
        diffs.push({
          label: 'Spending Cut %',
          a: pct(ag.decreaseStepPct),
          b: pct(bg.decreaseStepPct),
        });
      }
    }
  }

  // Scenario differences
  if (a.scenarioName !== b.scenarioName) {
    diffs.push({ label: 'Scenario', a: a.scenarioName, b: b.scenarioName });
  }

  if (a.isStressRun !== b.isStressRun) {
    diffs.push({
      label: 'Run Type',
      a: a.isStressRun ? `Stress: ${a.stressPathId ?? 'unknown'}` : 'Baseline',
      b: b.isStressRun ? `Stress: ${b.stressPathId ?? 'unknown'}` : 'Baseline',
    });
  }

  return diffs;
}

function buildOutcomeDiffs(
  a: WithdrawalStrategyRunResult,
  b: WithdrawalStrategyRunResult
): WithdrawalStrategyComparisonResult['outcomeDiffs'] {
  const diffs: WithdrawalStrategyComparisonResult['outcomeDiffs'] = [];

  // Success
  diffs.push({
    label: 'Plan Success',
    a: a.success ? 'Yes' : 'No',
    b: b.success ? 'Yes' : 'No',
    delta: '',
    direction:
      a.success === b.success
        ? 'neutral'
        : b.success
        ? 'better'
        : 'worse',
  });

  // First depletion year
  const aDeplete = a.firstDepletionYear?.toString() ?? 'Never';
  const bDeplete = b.firstDepletionYear?.toString() ?? 'Never';
  const depleteDelta =
    a.firstDepletionYear !== null && b.firstDepletionYear !== null
      ? b.firstDepletionYear - a.firstDepletionYear
      : null;
  diffs.push({
    label: 'First Depletion Year',
    a: aDeplete,
    b: bDeplete,
    delta:
      depleteDelta !== null
        ? depleteDelta > 0
          ? `+${depleteDelta} yrs`
          : depleteDelta < 0
          ? `${depleteDelta} yrs`
          : 'same'
        : '',
    direction:
      depleteDelta === null
        ? 'neutral'
        : depleteDelta > 0
        ? 'better'
        : depleteDelta < 0
        ? 'worse'
        : 'neutral',
  });

  // Ending assets
  const assetDelta = b.endingAssets - a.endingAssets;
  diffs.push({
    label: 'Ending Assets',
    a: fmt(a.endingAssets),
    b: fmt(b.endingAssets),
    delta: (assetDelta >= 0 ? '+' : '') + fmt(assetDelta),
    direction: assetDelta > 0 ? 'better' : assetDelta < 0 ? 'worse' : 'neutral',
  });

  // Total withdrawals
  const wDelta = b.totalWithdrawals - a.totalWithdrawals;
  diffs.push({
    label: 'Total Withdrawals',
    a: fmt(a.totalWithdrawals),
    b: fmt(b.totalWithdrawals),
    delta: (wDelta >= 0 ? '+' : '') + fmt(wDelta),
    direction: 'neutral', // more withdrawals is neither better nor worse by default
  });

  // Average annual withdrawal
  const avgDelta = b.averageAnnualWithdrawal - a.averageAnnualWithdrawal;
  diffs.push({
    label: 'Avg Annual Withdrawal',
    a: fmt(a.averageAnnualWithdrawal),
    b: fmt(b.averageAnnualWithdrawal),
    delta: (avgDelta >= 0 ? '+' : '') + fmt(avgDelta),
    direction: 'neutral',
  });

  // Total taxes
  const taxDelta = b.totalTaxes - a.totalTaxes;
  diffs.push({
    label: 'Total Taxes',
    a: fmt(a.totalTaxes),
    b: fmt(b.totalTaxes),
    delta: (taxDelta >= 0 ? '+' : '') + fmt(taxDelta),
    direction: taxDelta < 0 ? 'better' : taxDelta > 0 ? 'worse' : 'neutral',
  });

  // Years fully funded
  const fundedDelta = b.yearsFullyFunded - a.yearsFullyFunded;
  diffs.push({
    label: 'Years Fully Funded',
    a: num(a.yearsFullyFunded),
    b: num(b.yearsFullyFunded),
    delta: fundedDelta !== 0 ? (fundedDelta > 0 ? `+${fundedDelta}` : `${fundedDelta}`) : 'same',
    direction: fundedDelta > 0 ? 'better' : fundedDelta < 0 ? 'worse' : 'neutral',
  });

  return diffs;
}
