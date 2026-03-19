/**
 * Capital Gains Approximation Service — Phase 9
 *
 * Planning-grade capital gains estimation for taxable brokerage account withdrawals.
 *
 * Method:
 * Tracks cost basis per taxable account. When a withdrawal is made, the gain
 * fraction of the withdrawal is treated as long-term capital gain; the basis
 * fraction is treated as return of capital (not taxable).
 *
 * Initial basis: set via `capitalGainsBasisRatio` in TaxAssumptions.
 *   Default = 0.60, meaning 60% of the current balance is cost basis
 *   and 40% is unrealized gain.
 *
 * Basis tracking per year:
 * - Decreases by the basis portion of each withdrawal
 * - Increases by new contributions (new money = full basis)
 * - Does NOT grow with market returns (unrealized gains accumulate)
 *
 * v1 Limitations:
 * - Long-term gains only (no short-term gain distinction)
 * - Uniform gain ratio applied across all taxable accounts
 * - No wash-sale rule modeling
 * - No tax-loss harvesting
 * - Basis tracking resets each run (no memory of prior-year withdrawals)
 * - Planning estimates only — not tax preparation software
 */

import type { CapitalGainsApproximationResult } from './types';

// ---------------------------------------------------------------------------
// Basis state management
// ---------------------------------------------------------------------------

/**
 * Mutable basis state for taxable accounts.
 * Stored as the total cost basis across all taxable accounts combined.
 * Initialized from `capitalGainsBasisRatio × total taxable balance`.
 */
export interface TaxableBasisState {
  /** Current aggregate cost basis of all taxable accounts. */
  totalBasis: number;
  /** Current aggregate balance of all taxable accounts (for gain ratio). */
  totalBalance: number;
}

/**
 * Initialize basis state from the opening taxable balances.
 */
export function initializeBasisState(
  totalTaxableBalance: number,
  capitalGainsBasisRatio: number
): TaxableBasisState {
  const clampedRatio = Math.max(0, Math.min(1, capitalGainsBasisRatio));
  return {
    totalBasis: totalTaxableBalance * clampedRatio,
    totalBalance: totalTaxableBalance,
  };
}

// ---------------------------------------------------------------------------
// Capital gains rate helper
// ---------------------------------------------------------------------------

/**
 * Determine the LTCG rate to apply given the filer's ordinary taxable income.
 *
 * This uses simplified LTCG thresholds (2024 values, not inflated in v1
 * — a minor simplification for planning purposes).
 *
 * MFJ:  0% ≤ $94,050 ordinary, 15% ≤ $583,750, 20% above
 * SINGLE: 0% ≤ $47,025, 15% ≤ $518,900, 20% above
 * HoH:  0% ≤ $63,000, 15% ≤ $551,350, 20% above
 * MFS:  0% ≤ $47,025, 15% ≤ $291,850, 20% above
 */
export function estimateCapitalGainsRate(
  filingStatus: string,
  ordinaryTaxableIncome: number
): number {
  const thresholds: Record<string, [number, number]> = {
    SINGLE:                      [47_025,  518_900],
    MARRIED_FILING_JOINTLY:      [94_050,  583_750],
    HEAD_OF_HOUSEHOLD:           [63_000,  551_350],
    MARRIED_FILING_SEPARATELY:   [47_025,  291_850],
  };
  const [t0pct, t15pct] = thresholds[filingStatus] ?? [47_025, 518_900];
  if (ordinaryTaxableIncome <= t0pct) return 0.00;
  if (ordinaryTaxableIncome <= t15pct) return 0.15;
  return 0.20;
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export interface CapitalGainsInput {
  /** Gross withdrawal amount sourced from taxable accounts this year. */
  taxableWithdrawal: number;
  /** Filing status (for rate lookup). */
  filingStatus: string;
  /** Ordinary taxable income after deductions (for rate lookup). */
  ordinaryTaxableIncome: number;
  /** Current mutable basis state (will be mutated). */
  basisState: TaxableBasisState;
  /** New contributions to taxable accounts this year (all basis). */
  newContributions: number;
  /** Account growth this year (for balance tracking). */
  accountGrowth: number;
}

/**
 * Estimate capital gains tax on a taxable-account withdrawal.
 * Updates `basisState` in-place after the computation.
 */
export function estimateCapitalGainsTax(
  input: CapitalGainsInput
): CapitalGainsApproximationResult {
  const {
    taxableWithdrawal,
    filingStatus,
    ordinaryTaxableIncome,
    basisState,
    newContributions,
    accountGrowth,
  } = input;

  // Update balance for growth and contributions (basis doesn't grow with market)
  basisState.totalBalance = Math.max(
    0,
    basisState.totalBalance + accountGrowth + newContributions
  );
  basisState.totalBasis = Math.min(
    basisState.totalBalance,
    basisState.totalBasis + newContributions
  );

  if (taxableWithdrawal <= 0 || basisState.totalBalance <= 0) {
    return {
      taxableWithdrawal,
      estimatedGainAmount: 0,
      basisPortion: 0,
      capitalGainsRate: 0,
      estimatedCapitalGainsTax: 0,
    };
  }

  // Gain ratio: fraction of the balance that is unrealized gain
  const gainRatio = Math.max(
    0,
    Math.min(1, 1 - basisState.totalBasis / basisState.totalBalance)
  );

  const gainPortion = taxableWithdrawal * gainRatio;
  const basisPortion = taxableWithdrawal - gainPortion;

  // Reduce basis by the basis fraction withdrawn
  const withdrawalFraction = Math.min(1, taxableWithdrawal / basisState.totalBalance);
  basisState.totalBasis = Math.max(0, basisState.totalBasis - basisPortion);
  basisState.totalBalance = Math.max(0, basisState.totalBalance - taxableWithdrawal);
  void withdrawalFraction; // suppress unused variable warning

  const cgRate = estimateCapitalGainsRate(filingStatus, ordinaryTaxableIncome);
  const cgTax = gainPortion * cgRate;

  return {
    taxableWithdrawal,
    estimatedGainAmount: gainPortion,
    basisPortion,
    capitalGainsRate: cgRate,
    estimatedCapitalGainsTax: cgTax,
  };
}

/**
 * Compute the total current taxable balance from account balances.
 */
export function sumTaxableBalances(
  accountBalances: Record<string, number>,
  accounts: Array<{ id: string; taxTreatment: string }>
): number {
  return accounts
    .filter((a) => a.taxTreatment === 'TAXABLE')
    .reduce((sum, a) => sum + (accountBalances[a.id] ?? 0), 0);
}

/**
 * Compute taxable account contributions for the year.
 */
export function sumTaxableContributions(
  accounts: Array<{ id: string; taxTreatment: string; annualContribution: number; memberId: string | null }>
,
  memberRetired: Record<string, boolean>,
  memberAlive: Record<string, boolean>
): number {
  return accounts
    .filter((a) => a.taxTreatment === 'TAXABLE')
    .reduce((sum, a) => {
      if (a.memberId && !memberAlive[a.memberId]) return sum;
      // Taxable accounts continue contributions even in retirement (non-retirement accounts)
      return sum + a.annualContribution;
    }, 0);
}
