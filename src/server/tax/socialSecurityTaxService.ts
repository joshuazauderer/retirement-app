/**
 * Social Security Tax Service — Phase 9
 *
 * Planning-grade approximation for the taxable portion of Social Security benefits.
 *
 * Method: IRS provisional income approach (Publication 915).
 *
 * Provisional income = MAGI (modified adjusted gross income) + 50% of SS benefits.
 * For v1, MAGI proxy = earned income + non-SS benefit income + tax-deferred withdrawals
 *   + capital gains + Roth conversion amounts.
 * Tax-exempt interest is simplified as $0.
 *
 * Taxable SS rules (2024 law; thresholds not indexed for inflation):
 * - MFJ Threshold 1 = $32,000 | Threshold 2 = $44,000
 * - All other filing statuses: Threshold 1 = $25,000 | Threshold 2 = $34,000
 * - MFS: Thresholds are $0/$0 — effectively 85% of SS may be taxable
 *
 * Tier logic (per IRS worksheet):
 * - PI < T1: 0% of SS is taxable
 * - T1 ≤ PI < T2: taxable = min(50% × SS, 50% × (PI − T1))
 * - PI ≥ T2: taxable = min(85% × SS, tier1_max + 85% × (PI − T2))
 *   where tier1_max = min(50% × SS, 50% × (T2 − T1))
 *
 * v1 Limitations:
 * - Thresholds are NOT indexed to inflation (matches 2024 law)
 * - MFS uses 0/0 thresholds (effectively treats all SS as subject to 85% test)
 * - Tax-exempt interest excluded from provisional income (simplification)
 * - Planning estimates only
 */

import type { FilingStatusType, SocialSecurityTaxResult } from './types';
import { SS_TAX_THRESHOLDS } from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SsTaxInput {
  filingStatus: FilingStatusType;
  /** Total SS benefits received this year (annual). */
  ssBenefits: number;
  /**
   * Provisional income proxy (MAGI excluding SS).
   * = earned income + non-SS benefits + tax-deferred withdrawals + capital gains + conversions.
   */
  magiExcludingSS: number;
}

/**
 * Estimate the taxable portion of Social Security benefits for the year.
 *
 * Returns zero if SS benefits are zero.
 */
export function estimateSocialSecurityTax(input: SsTaxInput): SocialSecurityTaxResult {
  const { filingStatus, ssBenefits, magiExcludingSS } = input;

  if (ssBenefits <= 0) {
    return {
      ssBenefits: 0,
      provisionalIncome: magiExcludingSS,
      taxablePercentage: 0,
      taxableSsAmount: 0,
    };
  }

  const { t1, t2 } = SS_TAX_THRESHOLDS[filingStatus];

  // Provisional income = MAGI + 50% of SS benefits
  const provisionalIncome = magiExcludingSS + 0.5 * ssBenefits;

  let taxableSsAmount = 0;

  if (t1 === 0 && t2 === 0) {
    // MARRIED_FILING_SEPARATELY: all SS subject to the 85% cap test
    taxableSsAmount = Math.min(0.85 * ssBenefits, 0.85 * provisionalIncome);
  } else if (provisionalIncome <= t1) {
    // Below threshold 1: none taxable
    taxableSsAmount = 0;
  } else if (provisionalIncome <= t2) {
    // Between threshold 1 and 2: up to 50% of SS taxable
    const excess = provisionalIncome - t1;
    taxableSsAmount = Math.min(0.5 * ssBenefits, 0.5 * excess);
  } else {
    // Above threshold 2: up to 85% of SS taxable
    // Tier 1 contribution: up to 50% of SS from the T1→T2 band
    const tier1Max = Math.min(0.5 * ssBenefits, 0.5 * (t2 - t1));
    // Tier 2 contribution: 85% of excess above T2
    const tier2 = 0.85 * (provisionalIncome - t2);
    taxableSsAmount = Math.min(0.85 * ssBenefits, tier1Max + tier2);
  }

  taxableSsAmount = Math.max(0, taxableSsAmount);
  const taxablePercentage = ssBenefits > 0 ? taxableSsAmount / ssBenefits : 0;

  return {
    ssBenefits,
    provisionalIncome,
    taxablePercentage,
    taxableSsAmount,
  };
}

/**
 * Estimate Social Security benefits within a benefits income total.
 *
 * If the caller cannot separate SS from pensions, use this helper with a
 * fraction assumption. For accurate results, callers should pass the actual
 * SS benefit amount.
 */
export function estimateSsBenefitFromTotal(
  totalBenefitsIncome: number,
  ssFraction: number
): number {
  return Math.max(0, totalBenefitsIncome * ssFraction);
}
