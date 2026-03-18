import type { SimulationSnapshot, DeterministicProjectionResult } from '@/server/simulation/types';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import type { WithdrawalCalculatorResult } from './types';

const MAX_SUSTAINABLE_SEARCH = 200_000;
const BINARY_SEARCH_ITERATIONS = 20;
const CONVERGENCE = 100;

function clone(s: SimulationSnapshot): SimulationSnapshot {
  return JSON.parse(JSON.stringify(s));
}

function withRetirementSpending(snapshot: SimulationSnapshot, annualSpending: number): DeterministicProjectionResult {
  const s = clone(snapshot);
  const ep = s.expenseProfile;
  const healthcare = ep.healthcareAnnual;
  const housing = ep.housingAnnual;
  const remaining = Math.max(0, annualSpending - healthcare - housing);
  s.expenseProfile = {
    ...ep,
    retirementEssential: remaining * 0.7,
    retirementDiscretionary: remaining * 0.3,
  };
  return runDeterministicProjection(s);
}

export function computeWithdrawalCalculator(
  snapshot: SimulationSnapshot,
  projectionResult?: DeterministicProjectionResult
): WithdrawalCalculatorResult {
  const result = projectionResult ?? runDeterministicProjection(snapshot);
  const { summary, yearByYear } = result;

  // Mode A: planned withdrawal average
  const firstRetirement = summary.firstRetirementYear;
  const retirementYears = firstRetirement ? yearByYear.filter(y => y.year >= firstRetirement) : yearByYear;
  const plannedWithdrawal = retirementYears.length > 0
    ? retirementYears.reduce((s, y) => s + y.actualWithdrawal, 0) / retirementYears.length
    : 0;

  // Mode B: sustainable withdrawal binary search
  let sustainableAmount: number | null = null;
  let boundReached = false;

  if (!summary.success) {
    // Check if zero spending succeeds
    const zeroTest = withRetirementSpending(snapshot, 0);
    if (zeroTest.summary.firstDepletionYear !== null) {
      sustainableAmount = null;
      boundReached = true;
    } else {
      let lo = 0, hi = MAX_SUSTAINABLE_SEARCH;
      const maxTest = withRetirementSpending(snapshot, hi);
      if (maxTest.summary.firstDepletionYear === null) {
        sustainableAmount = hi;
        boundReached = true;
      } else {
        for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
          const mid = (lo + hi) / 2;
          const test = withRetirementSpending(snapshot, mid);
          if (test.summary.firstDepletionYear === null) lo = mid; else hi = mid;
          if (hi - lo < CONVERGENCE) break;
        }
        sustainableAmount = Math.floor(lo / 100) * 100;
      }
    }
  } else {
    sustainableAmount = Math.round(plannedWithdrawal);
  }

  const difference = sustainableAmount !== null ? sustainableAmount - plannedWithdrawal : null;

  return {
    plannedAnnualWithdrawal: plannedWithdrawal,
    currentPlanDepletes: !summary.success,
    currentPlanFirstDepletionYear: summary.firstDepletionYear,
    sustainableAnnualWithdrawal: sustainableAmount,
    sustainableMonthlyWithdrawal: sustainableAmount !== null ? Math.floor(sustainableAmount / 12) : null,
    withdrawalDifference: difference,
    searchBoundReached: boundReached,
    note: 'Planning-grade estimate based on deterministic projections under current assumptions. Actual results will vary.',
  };
}
