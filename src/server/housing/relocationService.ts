/**
 * Relocation Service
 *
 * Models a relocation-related housing cost change.
 * Handles move costs, new housing cost profile, and state-tax implication awareness.
 *
 * Planning-grade estimates only. Not real-estate or tax advice.
 */

import type { RelocationConfig, EquityReleaseResult } from './types';

export interface RelocationResult {
  eventYear: number;
  destinationState: string;
  moveCost: number;
  equityRelease?: EquityReleaseResult;  // If selling and buying in new location
  newAnnualHousingCost: number;
  housingCostChange: number;            // Positive = increase, negative = decrease
  stateTaxImplication: string;          // Descriptive note only (planning-grade)
}

/**
 * Compute relocation financial impact.
 */
export function computeRelocationResult(
  config: RelocationConfig,
  currentAnnualHousingCost: number,
  currentPropertyValue: number,
  currentMortgageBalance: number,
  sellingCostPercent: number,
): RelocationResult {
  let equityRelease: EquityReleaseResult | undefined;

  if (config.buyReplacementHome) {
    const sellingCosts = currentPropertyValue * sellingCostPercent;
    const netReleasedEquity = Math.max(
      0,
      currentPropertyValue
      - sellingCosts
      - currentMortgageBalance
      - config.replacementHomeCost
      - config.oneTimeMoveCost,
    );

    equityRelease = {
      grossSalePrice: currentPropertyValue,
      sellingCosts,
      mortgagePayoff: currentMortgageBalance,
      replacementHomeCost: config.replacementHomeCost,
      oneTimeMoveCost: config.oneTimeMoveCost,
      netReleasedEquity,
    };
  }

  return {
    eventYear: config.eventYear,
    destinationState: config.destinationState,
    moveCost: config.oneTimeMoveCost,
    equityRelease,
    newAnnualHousingCost: config.newAnnualHousingCost,
    housingCostChange: config.newAnnualHousingCost - currentAnnualHousingCost,
    stateTaxImplication: buildStateTaxNote(config.destinationState),
  };
}

/**
 * Provide a planning-grade note about state tax implications of relocation.
 * Does not compute exact state taxes — that is handled by the tax engine.
 */
function buildStateTaxNote(destinationState: string): string {
  const noIncomeTaxStates = new Set([
    'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WY', 'WA',
  ]);

  if (noIncomeTaxStates.has(destinationState.toUpperCase())) {
    return `${destinationState} has no state income tax — this may reduce your state tax burden in future years. Update your scenario's state tax assumption to reflect this.`;
  }
  return `Review your scenario's state tax assumption after relocating to ${destinationState}. State income tax rates vary significantly.`;
}

/**
 * No-income-tax state check for relocation UI display.
 */
export function isNoIncomeTaxRelocationState(stateCode: string): boolean {
  const noIncomeTaxStates = new Set([
    'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WY', 'WA',
  ]);
  return noIncomeTaxStates.has(stateCode.toUpperCase());
}
