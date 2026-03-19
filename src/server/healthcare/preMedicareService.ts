// Pre-Medicare healthcare cost estimation

import type { PreMedicareHealthcareCosts } from './types';

/**
 * Estimate annual pre-Medicare healthcare cost for a single person
 * inflated to the given year relative to a base year.
 */
export function estimatePreMedicareCost(
  config: PreMedicareHealthcareCosts,
  year: number,
  baseYear: number,
  healthcareInflationRate: number,
): number {
  const yearsFromBase = Math.max(0, year - baseYear);
  const inflationFactor = Math.pow(1 + healthcareInflationRate, yearsFromBase);

  const annualPremium = config.annualPremium * inflationFactor;
  const annualOOP = config.annualOutOfPocket * inflationFactor;

  return annualPremium + annualOOP;
}

/**
 * Return the annual pre-Medicare cost for a person based on their age.
 * If age >= medicareEligibilityAge, return 0 (handled by Medicare module).
 */
export function getPreMedicareCostForYear(
  config: PreMedicareHealthcareCosts,
  personAge: number,
  medicareEligibilityAge: number,
  year: number,
  baseYear: number,
  healthcareInflationRate: number,
): number {
  if (personAge >= medicareEligibilityAge) return 0;
  return estimatePreMedicareCost(config, year, baseYear, healthcareInflationRate);
}
