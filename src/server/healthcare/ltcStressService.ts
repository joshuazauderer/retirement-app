// Long-term care stress case modeling

import type { LongTermCareStressConfig } from './types';

export interface LtcStressResult {
  ltcCost: number;
  ltcActive: boolean;
}

/**
 * Compute LTC cost for a given year.
 * LTC costs begin when primary person reaches startAge and last durationYears.
 * Costs are inflated forward from the plan start year.
 */
export function getLtcCostForYear(
  config: LongTermCareStressConfig,
  primaryAge: number,
  year: number,
  baseYear: number,
  healthcareInflationRate: number,
): LtcStressResult {
  if (!config.enabled) return { ltcCost: 0, ltcActive: false };

  const endAge = config.startAge + config.durationYears;
  if (primaryAge < config.startAge || primaryAge >= endAge) {
    return { ltcCost: 0, ltcActive: false };
  }

  const yearsFromBase = Math.max(0, year - baseYear);
  const inflationFactor = Math.pow(1 + healthcareInflationRate, yearsFromBase);
  const ltcCost = config.annualCost * inflationFactor;

  return { ltcCost, ltcActive: true };
}

/**
 * Check if LTC stress is active in this year.
 */
export function isLtcActive(config: LongTermCareStressConfig, primaryAge: number): boolean {
  if (!config.enabled) return false;
  const endAge = config.startAge + config.durationYears;
  return primaryAge >= config.startAge && primaryAge < endAge;
}
