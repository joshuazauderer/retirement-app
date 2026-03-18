import type { SimulationSnapshot } from '@/server/simulation/types';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import type { SavingsGapResult } from './types';

const MAX_ADDITIONAL_SAVINGS = 100_000;   // $100k/yr max
const MAX_SPENDING_REDUCTION_RATIO = 0.5; // max 50% discretionary cut
const BINARY_SEARCH_ITERATIONS = 20;
const CONVERGENCE = 100; // $100 precision

function clone(s: SimulationSnapshot): SimulationSnapshot {
  return JSON.parse(JSON.stringify(s));
}

function runs(snapshot: SimulationSnapshot): boolean {
  return runDeterministicProjection(snapshot).summary.firstDepletionYear === null;
}

function findSavingsIncrease(snapshot: SimulationSnapshot): { amount: number | null; boundReached: boolean } {
  if (runs(snapshot)) return { amount: 0, boundReached: false };

  const firstAccIdx = snapshot.assetAccounts.findIndex(a => !a.isRetirementAccount || true); // use first account
  if (firstAccIdx < 0) return { amount: null, boundReached: true };

  const maxSnap = clone(snapshot);
  maxSnap.assetAccounts[firstAccIdx] = {
    ...maxSnap.assetAccounts[firstAccIdx],
    annualContribution: maxSnap.assetAccounts[firstAccIdx].annualContribution + MAX_ADDITIONAL_SAVINGS,
  };
  if (!runs(maxSnap)) return { amount: null, boundReached: true };

  let lo = 0, hi = MAX_ADDITIONAL_SAVINGS;
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const test = clone(snapshot);
    test.assetAccounts[firstAccIdx] = {
      ...test.assetAccounts[firstAccIdx],
      annualContribution: test.assetAccounts[firstAccIdx].annualContribution + mid,
    };
    if (runs(test)) hi = mid; else lo = mid;
    if (hi - lo < CONVERGENCE) break;
  }
  return { amount: Math.ceil(hi / 100) * 100, boundReached: false };
}

function findSpendingReduction(snapshot: SimulationSnapshot): { amount: number | null; boundReached: boolean } {
  if (runs(snapshot)) return { amount: 0, boundReached: false };

  const ep = snapshot.expenseProfile;
  const discretionary = ep.retirementDiscretionary > 0 ? ep.retirementDiscretionary : ep.currentAnnualSpending * 0.3;
  const maxCut = discretionary * MAX_SPENDING_REDUCTION_RATIO;

  const maxSnap = clone(snapshot);
  maxSnap.expenseProfile = { ...maxSnap.expenseProfile, retirementDiscretionary: Math.max(0, ep.retirementDiscretionary - maxCut) };
  if (!runs(maxSnap)) return { amount: null, boundReached: true };

  let lo = 0, hi = maxCut;
  for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const test = clone(snapshot);
    test.expenseProfile = { ...test.expenseProfile, retirementDiscretionary: Math.max(0, ep.retirementDiscretionary - mid) };
    if (runs(test)) hi = mid; else lo = mid;
    if (hi - lo < CONVERGENCE) break;
  }
  return { amount: Math.ceil(hi / 100) * 100, boundReached: false };
}

export function computeSavingsGap(snapshot: SimulationSnapshot): SavingsGapResult {
  const baseline = runDeterministicProjection(snapshot);
  const baselineSuccess = baseline.summary.firstDepletionYear === null;

  if (baselineSuccess) {
    return {
      baselineSuccess: true, firstDepletionYear: null,
      additionalAnnualSavingsNeeded: 0, additionalMonthlySavingsNeeded: 0,
      retirementSpendingReductionNeeded: 0, retirementMonthlySpendingReductionNeeded: 0,
      searchBoundReached: false,
      note: 'Your current plan is on track. No additional savings or spending changes are required.',
    };
  }

  const savingsRes = findSavingsIncrease(snapshot);
  const spendingRes = findSpendingReduction(snapshot);

  return {
    baselineSuccess: false,
    firstDepletionYear: baseline.summary.firstDepletionYear,
    additionalAnnualSavingsNeeded: savingsRes.amount,
    additionalMonthlySavingsNeeded: savingsRes.amount !== null ? Math.ceil(savingsRes.amount / 12) : null,
    retirementSpendingReductionNeeded: spendingRes.amount,
    retirementMonthlySpendingReductionNeeded: spendingRes.amount !== null ? Math.ceil(spendingRes.amount / 12) : null,
    searchBoundReached: savingsRes.boundReached || spendingRes.boundReached,
    note: (savingsRes.boundReached && spendingRes.boundReached)
      ? 'The gap may require more significant changes. Consider working with a financial advisor.'
      : 'Estimates are planning-grade only and based on current assumptions.',
  };
}
