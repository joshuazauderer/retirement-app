/**
 * Pre-Medicare Cost Service
 *
 * Models higher healthcare costs before Medicare eligibility (typically age 65).
 * Handles:
 * - Single retirees with pre-Medicare bridge years
 * - Couples where one spouse becomes eligible before the other
 * - Survivor households
 *
 * Planning-grade estimates only. Not insurance quoting software.
 */

export {
  estimatePreMedicareCost,
  getPreMedicareCostForYear,
} from './preMedicareService';

import type { PreMedicareHealthcareCosts } from './types';
import { estimatePreMedicareCost } from './preMedicareService';

/**
 * Compute the total household pre-Medicare cost for a year.
 * Handles couple households with different Medicare eligibility timing.
 */
export function computeHouseholdPreMedicareCost(params: {
  config: PreMedicareHealthcareCosts;
  primaryAge: number;
  spouseAge: number | undefined;
  medicareEligibilityAge: number;
  includeSpouse: boolean;
  year: number;
  baseYear: number;
  healthcareInflationRate: number;
}): { primaryCost: number; spouseCost: number; total: number } {
  const primaryCost =
    params.primaryAge >= params.medicareEligibilityAge
      ? 0
      : estimatePreMedicareCost(
          params.config,
          params.year,
          params.baseYear,
          params.healthcareInflationRate,
        );

  let spouseCost = 0;
  if (params.includeSpouse && params.spouseAge != null) {
    spouseCost =
      params.spouseAge >= params.medicareEligibilityAge
        ? 0
        : estimatePreMedicareCost(
            params.config,
            params.year,
            params.baseYear,
            params.healthcareInflationRate,
          );
  }

  return { primaryCost, spouseCost, total: primaryCost + spouseCost };
}

/**
 * Determine the number of pre-Medicare bridge years remaining for a person.
 * Useful for summary display.
 */
export function preMedicareBridgeYearsRemaining(
  currentAge: number,
  medicareEligibilityAge: number,
): number {
  return Math.max(0, medicareEligibilityAge - currentAge);
}
