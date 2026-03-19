/**
 * State Tax Service — Phase 9
 *
 * Planning-grade state income tax estimator.
 *
 * v1 Implementation:
 * Uses a simplified flat effective rate per state, representing an approximate
 * effective rate for a middle-income retiree household ($60k–$100k total income).
 *
 * v1 Limitations:
 * - Flat effective rate only (not full state bracket replication)
 * - Does not model state-specific retirement income exclusions
 *   (e.g., some states exempt SS benefits, some exempt pensions)
 * - Does not model state standard deductions
 * - Rate table based on 2024 law; not updated automatically
 * - No state-specific LTCG treatment
 * - Planning estimates only — not state tax preparation software
 *
 * States with no income tax return 0% rate. All rates documented in the table below.
 */

import type { StateTaxResult } from './types';

// ---------------------------------------------------------------------------
// State effective rate table (2024 approximate effective rates)
//
// Sources: Tax Foundation, state revenue departments (simplified planning rates).
// These are approximate effective rates for moderate retirement income.
// ---------------------------------------------------------------------------

const STATE_EFFECTIVE_RATES: Record<string, number> = {
  AL: 0.040,  // Alabama ~4% effective
  AK: 0.000,  // Alaska — no income tax
  AZ: 0.025,  // Arizona 2.5% flat (2023+)
  AR: 0.040,  // Arkansas ~4% effective
  CA: 0.073,  // California ~7.3% effective (moderate income)
  CO: 0.044,  // Colorado 4.4% flat
  CT: 0.050,  // Connecticut ~5% effective
  DE: 0.052,  // Delaware ~5.2% effective
  FL: 0.000,  // Florida — no income tax
  GA: 0.055,  // Georgia ~5.5% effective
  HI: 0.075,  // Hawaii ~7.5% effective
  ID: 0.058,  // Idaho ~5.8% effective
  IL: 0.0495, // Illinois 4.95% flat
  IN: 0.031,  // Indiana 3.15% flat (2023)
  IA: 0.048,  // Iowa ~4.8% effective (post-2023 reform)
  KS: 0.052,  // Kansas ~5.2% effective
  KY: 0.045,  // Kentucky 4.5% flat
  LA: 0.040,  // Louisiana ~4% effective
  ME: 0.058,  // Maine ~5.8% effective
  MD: 0.048,  // Maryland ~4.8% effective (state only; county adds ~2.5%)
  MA: 0.050,  // Massachusetts 5% flat
  MI: 0.0425, // Michigan 4.25% flat
  MN: 0.055,  // Minnesota ~5.5% effective
  MS: 0.040,  // Mississippi 4% flat (income > $10k)
  MO: 0.046,  // Missouri ~4.6% effective
  MT: 0.055,  // Montana ~5.5% effective
  NE: 0.055,  // Nebraska ~5.5% effective
  NV: 0.000,  // Nevada — no income tax
  NH: 0.000,  // New Hampshire — no income tax (dividends/interest tax phased out 2025)
  NJ: 0.055,  // New Jersey ~5.5% effective
  NM: 0.044,  // New Mexico ~4.4% effective
  NY: 0.063,  // New York ~6.3% effective (state; NYC adds additional)
  NC: 0.0475, // North Carolina 4.75% flat
  ND: 0.020,  // North Dakota ~2% effective
  OH: 0.035,  // Ohio ~3.5% effective
  OK: 0.048,  // Oklahoma ~4.8% effective
  OR: 0.072,  // Oregon ~7.2% effective
  PA: 0.0307, // Pennsylvania 3.07% flat
  RI: 0.048,  // Rhode Island ~4.8% effective
  SC: 0.055,  // South Carolina ~5.5% effective
  SD: 0.000,  // South Dakota — no income tax
  TN: 0.000,  // Tennessee — no income tax (Hall Tax eliminated 2021)
  TX: 0.000,  // Texas — no income tax
  UT: 0.0465, // Utah 4.65% flat
  VT: 0.055,  // Vermont ~5.5% effective
  VA: 0.055,  // Virginia ~5.5% effective
  WA: 0.000,  // Washington — no income tax (LT capital gains tax > $250k not modeled here)
  WV: 0.046,  // West Virginia ~4.6% effective
  WI: 0.053,  // Wisconsin ~5.3% effective
  WY: 0.000,  // Wyoming — no income tax
  DC: 0.065,  // Washington DC ~6.5% effective
};

/** States with no income tax. */
export const NO_INCOME_TAX_STATES = new Set(
  Object.entries(STATE_EFFECTIVE_RATES)
    .filter(([, rate]) => rate === 0)
    .map(([state]) => state)
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the planning-grade effective state income tax rate for a given state.
 * Returns 0 for states with no income tax or unknown states.
 *
 * @param stateCode Two-letter state abbreviation (e.g. "CA", "TX").
 */
export function getStateEffectiveRate(stateCode: string): number {
  if (!stateCode) return 0;
  const normalized = stateCode.trim().toUpperCase();
  return STATE_EFFECTIVE_RATES[normalized] ?? 0;
}

/**
 * Estimate annual state income tax.
 *
 * v1 simplification: applies the flat effective rate to the same ordinary taxable
 * income used for federal taxes. Does not model state-specific exclusions.
 *
 * @param stateCode Two-letter state abbreviation.
 * @param federalOrdinaryIncome The ordinary (non-capital-gains) income base
 *   (used as the state taxable income proxy).
 */
export function estimateStateTax(
  stateCode: string,
  federalOrdinaryIncome: number
): StateTaxResult {
  const normalized = stateCode?.trim().toUpperCase() ?? '';
  const stateRate = STATE_EFFECTIVE_RATES[normalized] ?? 0;
  const taxableIncome = Math.max(0, federalOrdinaryIncome);
  const stateTax = taxableIncome * stateRate;

  return {
    stateOfResidence: normalized || stateCode,
    taxableIncome,
    stateRate,
    stateTax,
  };
}

/**
 * Whether the given state has no income tax.
 */
export function isNoIncomeTaxState(stateCode: string): boolean {
  const normalized = stateCode?.trim().toUpperCase() ?? '';
  return (STATE_EFFECTIVE_RATES[normalized] ?? 0) === 0;
}

/**
 * Return a human-readable label for the state tax rate.
 */
export function stateTaxRateLabel(stateCode: string): string {
  const rate = getStateEffectiveRate(stateCode);
  if (rate === 0) {
    const noTaxStates = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];
    const normalized = stateCode?.trim().toUpperCase() ?? '';
    if (noTaxStates.includes(normalized)) {
      return 'No income tax';
    }
    return '0% (unknown state)';
  }
  return `${(rate * 100).toFixed(2)}% (planning-grade estimate)`;
}
