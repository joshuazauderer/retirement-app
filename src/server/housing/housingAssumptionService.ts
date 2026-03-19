/**
 * Housing Assumption Service
 *
 * Loads and validates housing assumptions.
 * Determines effective housing settings for a projection run.
 *
 * Planning-grade estimates only. Not real-estate or legal advice.
 */

import type {
  HousingPlanningInput,
  HousingStrategy,
  HousingPlanningValidation,
} from './types';
import { DEFAULT_APPRECIATION_RATE, DEFAULT_SELLING_COST_PERCENT } from './types';

export interface EffectiveHousingAssumptions {
  strategy: HousingStrategy;
  currentPropertyValue: number;
  currentMortgageBalance: number;
  annualAppreciationRate: number;
  preEventAnnualHousingCost: number;
  postEventAnnualHousingCost: number;
  housingEventYear?: number;
  sellingCostPercent: number;
  generalInflationRate: number;
}

/**
 * Load effective housing assumptions from input config.
 * Applies documented defaults where config is missing.
 */
export function loadEffectiveHousingAssumptions(
  input: HousingPlanningInput,
): EffectiveHousingAssumptions {
  const prop = input.currentProperty;

  let housingEventYear: number | undefined;
  let postEventAnnualHousingCost = prop.annualHousingCost;

  if (input.strategy === 'downsize' && input.downsizing.enabled) {
    housingEventYear = input.downsizing.eventYear;
    postEventAnnualHousingCost = input.downsizing.postMoveAnnualHousingCost;
  } else if (input.strategy === 'relocate' && input.relocation.enabled) {
    housingEventYear = input.relocation.eventYear;
    postEventAnnualHousingCost = input.relocation.newAnnualHousingCost;
  }

  return {
    strategy: input.strategy,
    currentPropertyValue: prop.currentValue,
    currentMortgageBalance: prop.mortgageBalance,
    annualAppreciationRate: prop.annualAppreciationRate ?? DEFAULT_APPRECIATION_RATE,
    preEventAnnualHousingCost: prop.annualHousingCost,
    postEventAnnualHousingCost,
    housingEventYear,
    sellingCostPercent: input.downsizing.sellingCostPercent ?? DEFAULT_SELLING_COST_PERCENT,
    generalInflationRate: input.generalInflationRate ?? 0.025,
  };
}

/**
 * Validate housing planning input before running a projection.
 */
export function validateHousingPlanningInput(
  input: HousingPlanningInput,
): HousingPlanningValidation {
  const errors: string[] = [];

  if (!input.householdId) errors.push('householdId is required');
  if (!input.scenarioId) errors.push('scenarioId is required');
  if (!input.label?.trim()) errors.push('label is required');

  if (input.currentProperty.currentValue < 0) errors.push('currentValue must be >= 0');
  if (input.currentProperty.mortgageBalance < 0) errors.push('mortgageBalance must be >= 0');
  if (input.currentProperty.annualHousingCost < 0) errors.push('annualHousingCost must be >= 0');

  if (input.strategy === 'downsize' && input.downsizing.enabled) {
    if (input.downsizing.expectedSalePrice <= 0) errors.push('Downsizing: expectedSalePrice must be > 0');
    if (input.downsizing.sellingCostPercent < 0 || input.downsizing.sellingCostPercent > 0.20) {
      errors.push('Downsizing: sellingCostPercent must be between 0 and 20%');
    }
    if (input.downsizing.buyReplacementHome && input.downsizing.replacementHomeCost <= 0) {
      errors.push('Downsizing: replacementHomeCost must be > 0 when buyReplacementHome is true');
    }
  }

  if (input.strategy === 'relocate' && input.relocation.enabled) {
    if (!input.relocation.destinationState) errors.push('Relocation: destinationState is required');
    if (input.relocation.newAnnualHousingCost < 0) errors.push('Relocation: newAnnualHousingCost must be >= 0');
  }

  if (input.gifting.enabled) {
    if (input.gifting.annualGiftAmount < 0) errors.push('Gifting: annualGiftAmount must be >= 0');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get housing cost for a given year, accounting for pre/post event transition.
 * Applies general inflation to housing costs.
 */
export function getAnnualHousingCostForYear(
  assumptions: EffectiveHousingAssumptions,
  year: number,
  baseYear: number,
  _mortgagePaidOff: boolean,
): number {
  const isPostEvent = assumptions.housingEventYear != null && year >= assumptions.housingEventYear;
  const baseCost = isPostEvent
    ? assumptions.postEventAnnualHousingCost
    : assumptions.preEventAnnualHousingCost;

  const yearsFromBase = Math.max(0, year - baseYear);
  const inflationFactor = Math.pow(1 + assumptions.generalInflationRate, yearsFromBase);
  return baseCost * inflationFactor;
}
