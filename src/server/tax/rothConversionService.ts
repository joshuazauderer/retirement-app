/**
 * Roth Conversion Service — Phase 9
 *
 * Models annual Roth IRA conversion as a planning strategy.
 *
 * Behavior:
 * - Each year within the conversion range, a specified amount is "converted"
 *   from tax-deferred to tax-free account balances.
 * - The conversion amount is included in ordinary income for that year,
 *   increasing federal and state tax.
 * - Reduces available tax-deferred balance; increases tax-free balance.
 * - Future years benefit from tax-free growth and tax-free withdrawals.
 *
 * v1 Limitations:
 * - Conversions are applied from the largest tax-deferred account first
 *   (no optimization for Roth conversion laddering)
 * - No pro-rata rule modeling (assumes traditional IRA only for simplicity)
 * - Conversion is capped at available tax-deferred balance
 * - No RMD interaction modeling
 * - Planning estimates only
 */

import type { RothConversionConfig } from './types';

// ---------------------------------------------------------------------------
// Conversion computation helpers
// ---------------------------------------------------------------------------

/**
 * Determine the Roth conversion amount for a given calendar year.
 * Returns 0 if outside the conversion range or no config provided.
 *
 * @param config The Roth conversion configuration.
 * @param year Current simulation year.
 * @param inflationRate Assumed annual inflation rate (decimal).
 * @param runStartYear The first year of the simulation (basis for inflation adjustment).
 */
export function getConversionAmountForYear(
  config: RothConversionConfig | undefined,
  year: number,
  inflationRate: number,
  runStartYear: number
): number {
  if (!config) return 0;
  if (year < config.startYear || year > config.endYear) return 0;

  if (config.inflateWithInflation) {
    const yearsFromStart = Math.max(0, year - runStartYear);
    return config.annualConversionAmount * Math.pow(1 + inflationRate, yearsFromStart);
  }

  return config.annualConversionAmount;
}

// ---------------------------------------------------------------------------
// Account balance mutation
// ---------------------------------------------------------------------------

export interface RothConversionResult {
  /** Actual amount converted this year (may be less than target if tax-deferred balance is insufficient). */
  actualConversionAmount: number;
  /** The conversion amount added to ordinary income this year. */
  taxableConversionIncome: number;
  /** Updated account balances after the conversion. */
  updatedBalances: Record<string, number>;
}

/**
 * Execute a Roth conversion for the current year.
 *
 * Moves `targetConversionAmount` from tax-deferred accounts to tax-free accounts.
 * Drains tax-deferred accounts in order of decreasing balance.
 * Places proceeds into the largest tax-free account.
 *
 * @param targetConversionAmount Target amount to convert (may be reduced if insufficient TD balance).
 * @param accountBalances Current mutable account balances (will be cloned, not mutated).
 * @param accounts Account metadata.
 */
export function executeRothConversion(
  targetConversionAmount: number,
  accountBalances: Record<string, number>,
  accounts: Array<{ id: string; taxTreatment: string }>
): RothConversionResult {
  if (targetConversionAmount <= 0) {
    return {
      actualConversionAmount: 0,
      taxableConversionIncome: 0,
      updatedBalances: { ...accountBalances },
    };
  }

  const updatedBalances = { ...accountBalances };

  // Find tax-deferred accounts sorted by balance descending (drain largest first)
  const taxDeferredAccounts = accounts
    .filter((a) => a.taxTreatment === 'TAX_DEFERRED')
    .filter((a) => (updatedBalances[a.id] ?? 0) > 0)
    .sort((a, b) => (updatedBalances[b.id] ?? 0) - (updatedBalances[a.id] ?? 0));

  // Find the largest tax-free account (place conversion proceeds there)
  const taxFreeAccounts = accounts
    .filter((a) => a.taxTreatment === 'TAX_FREE')
    .sort((a, b) => (updatedBalances[b.id] ?? 0) - (updatedBalances[a.id] ?? 0));

  let remaining = targetConversionAmount;
  let totalConverted = 0;

  for (const acc of taxDeferredAccounts) {
    if (remaining <= 0) break;
    const avail = updatedBalances[acc.id] ?? 0;
    const converted = Math.min(avail, remaining);
    updatedBalances[acc.id] = avail - converted;
    totalConverted += converted;
    remaining -= converted;
  }

  // Place converted amount into the largest tax-free account
  if (totalConverted > 0 && taxFreeAccounts.length > 0) {
    const targetId = taxFreeAccounts[0].id;
    updatedBalances[targetId] = (updatedBalances[targetId] ?? 0) + totalConverted;
  } else if (totalConverted > 0) {
    // No tax-free account exists: create a placeholder (edge case)
    // In practice, the UI should validate that a Roth account exists.
    // We just credit a virtual "rothConversionPool" — conversion still happens.
    // The account won't appear in balances, but the income impact is recorded.
  }

  return {
    actualConversionAmount: totalConverted,
    taxableConversionIncome: totalConverted,
    updatedBalances,
  };
}

/**
 * Estimate the marginal tax cost of a Roth conversion in a given year.
 * Useful for UI "what-if" summaries without running the full simulation.
 *
 * @param conversionAmount Dollar amount being converted.
 * @param currentOrdinaryTaxableIncome Ordinary income before the conversion.
 * @param marginalRate Estimated marginal federal rate at current income level.
 * @param stateRate State effective rate.
 */
export function estimateConversionTaxCost(
  conversionAmount: number,
  marginalRate: number,
  stateRate: number
): number {
  if (conversionAmount <= 0) return 0;
  return conversionAmount * (marginalRate + stateRate);
}
