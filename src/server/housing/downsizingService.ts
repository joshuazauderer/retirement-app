/**
 * Downsizing Service
 *
 * Models the sale of a current property and optional replacement purchase.
 * Computes net released equity that enters the retirement balance sheet.
 *
 * Planning-grade estimates only. Not real-estate transaction software.
 * Selling cost percentages are approximate planning assumptions.
 */

import type { DownsizingConfig, EquityReleaseResult } from './types';

/**
 * Compute net released equity from a downsizing event.
 *
 * Net released equity = Sale price
 *   - Selling costs (% of sale price)
 *   - Mortgage payoff
 *   - Replacement home cost (if buying)
 *   - One-time move cost
 */
export function computeDownsizingEquityRelease(
  config: DownsizingConfig,
): EquityReleaseResult {
  const sellingCosts = config.expectedSalePrice * config.sellingCostPercent;
  const replacementHomeCost = config.buyReplacementHome ? config.replacementHomeCost : 0;

  const netReleasedEquity =
    config.expectedSalePrice
    - sellingCosts
    - config.mortgagePayoffAmount
    - replacementHomeCost
    - config.oneTimeMoveCost;

  return {
    grossSalePrice: config.expectedSalePrice,
    sellingCosts,
    mortgagePayoff: config.mortgagePayoffAmount,
    replacementHomeCost,
    oneTimeMoveCost: config.oneTimeMoveCost,
    netReleasedEquity: Math.max(0, netReleasedEquity), // Cannot release negative equity
  };
}

/**
 * Estimate the property value at the time of sale, given appreciation.
 * Useful when user has not specified an exact sale price.
 */
export function estimateSalePriceAtYear(
  currentValue: number,
  currentYear: number,
  saleYear: number,
  annualAppreciationRate: number,
): number {
  const yearsToSale = Math.max(0, saleYear - currentYear);
  return currentValue * Math.pow(1 + annualAppreciationRate, yearsToSale);
}

/**
 * Estimate remaining mortgage balance at a future year.
 * Uses a simplified straight-line amortization approximation for planning.
 *
 * NOTE: This is a planning-grade approximation only.
 * Actual amortization schedules should be used for precise mortgage payoff calculations.
 */
export function estimateMortgageBalanceAtYear(
  currentBalance: number,
  annualPayment: number,
  currentYear: number,
  targetYear: number,
): number {
  if (currentBalance <= 0) return 0;
  const yearsElapsed = Math.max(0, targetYear - currentYear);
  // Simplified: reduce balance by annual P&I payment each year
  // (ignores interest; planning approximation only)
  const principalPaid = annualPayment * yearsElapsed * 0.6; // ~60% P&I goes to principal early on
  return Math.max(0, currentBalance - principalPaid);
}

/**
 * Summary of post-downsizing housing financial position.
 */
export interface DownsizingSummary {
  eventYear: number;
  equityRelease: EquityReleaseResult;
  replacementPropertyValue: number;
  replacementMortgageBalance: number;
  newAnnualHousingCost: number;
  housingCostReduction: number;   // Annual savings vs. prior housing cost
}

export function buildDownsizingSummary(
  config: DownsizingConfig,
  priorAnnualHousingCost: number,
): DownsizingSummary {
  const equityRelease = computeDownsizingEquityRelease(config);

  return {
    eventYear: config.eventYear,
    equityRelease,
    replacementPropertyValue: config.buyReplacementHome ? config.replacementHomeCost : 0,
    replacementMortgageBalance: config.buyReplacementHome ? config.replacementHomeMortgage : 0,
    newAnnualHousingCost: config.postMoveAnnualHousingCost,
    housingCostReduction: priorAnnualHousingCost - config.postMoveAnnualHousingCost,
  };
}
