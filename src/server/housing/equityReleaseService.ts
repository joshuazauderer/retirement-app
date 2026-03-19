/**
 * Equity Release Service
 *
 * Handles how net home-sale proceeds enter the retirement balance sheet.
 * Released equity increases investable assets.
 *
 * This is the accounting bridge between a housing event and the projection engine.
 * Planning-grade only. Not financial advice.
 */

import type { EquityReleaseResult } from './types';

export interface EquityReleaseBalanceSheetImpact {
  addToInvestableAssets: number;   // Net cash added to investable asset pool
  removedRealEstateEquity: number; // RE equity removed (sold property)
  addedRealEstateEquity: number;   // RE equity added (replacement home, if buying)
  netBalanceSheetChange: number;   // Should be approximately neutral (assets trade form)
}

/**
 * Compute how an equity release event affects the balance sheet.
 *
 * When selling a home:
 * - RE equity removed = sold property value - mortgage payoff
 * - Cash added = net released equity (sale price - costs - payoff - replacement)
 * - RE equity added = replacement home value (if buying with cash or partial financing)
 */
export function computeEquityReleaseBalanceSheetImpact(
  equityRelease: EquityReleaseResult,
  soldPropertyValue: number,
  replacementPropertyValue: number,
): EquityReleaseBalanceSheetImpact {
  const removedRealEstateEquity = soldPropertyValue - equityRelease.mortgagePayoff;
  const addedRealEstateEquity = replacementPropertyValue;
  const addToInvestableAssets = equityRelease.netReleasedEquity;

  // Net balance sheet change: should be ~0 in a pure asset-form-change
  // (positive means cash was extracted beyond RE equity; negative means extra cash paid in)
  const netBalanceSheetChange =
    addToInvestableAssets + addedRealEstateEquity - removedRealEstateEquity;

  return {
    addToInvestableAssets,
    removedRealEstateEquity,
    addedRealEstateEquity,
    netBalanceSheetChange,
  };
}

/**
 * Apply equity release to total assets (adds net released cash to investable pool).
 * Returns the new total investable asset balance after the event.
 */
export function applyEquityReleaseToAssets(
  currentTotalAssets: number,
  equityRelease: EquityReleaseResult,
): number {
  return currentTotalAssets + equityRelease.netReleasedEquity;
}

/**
 * Describe the equity release in plain English for UI display.
 */
export function describeEquityRelease(equityRelease: EquityReleaseResult): string[] {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const lines: string[] = [
    `Gross sale price: ${fmt(equityRelease.grossSalePrice)}`,
    `Selling costs (${((equityRelease.sellingCosts / equityRelease.grossSalePrice) * 100).toFixed(1)}%): -${fmt(equityRelease.sellingCosts)}`,
    `Mortgage payoff: -${fmt(equityRelease.mortgagePayoff)}`,
  ];
  if (equityRelease.replacementHomeCost > 0) {
    lines.push(`Replacement home: -${fmt(equityRelease.replacementHomeCost)}`);
  }
  if (equityRelease.oneTimeMoveCost > 0) {
    lines.push(`Move costs: -${fmt(equityRelease.oneTimeMoveCost)}`);
  }
  lines.push(`Net released equity: ${fmt(equityRelease.netReleasedEquity)}`);
  return lines;
}
