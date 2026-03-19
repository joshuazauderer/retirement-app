/**
 * Long-Term Care Stress Service
 *
 * Models planning-grade long-term care cost stress scenarios.
 * This is NOT a full LTC insurance model.
 *
 * Allows the user to inject a care-cost spike for a configurable duration
 * starting at a configurable age, representing:
 * - home health aide costs
 * - memory care facility costs
 * - assisted living costs
 * - informal care coordination costs
 *
 * National median LTC costs (2024 Genworth survey):
 * - Home health aide: ~$61,776/yr
 * - Assisted living: ~$64,200/yr
 * - Memory care: ~$72,000-100,000/yr
 * - Nursing home (semi-private): ~$104,000/yr
 *
 * Planning-grade estimates only. Not LTC insurance or care planning advice.
 */

export { getLtcCostForYear, isLtcActive } from './ltcStressService';

import type { LongTermCareStressConfig } from './types';
import { inflateHealthcareCost } from './healthcareInflationService';

/**
 * National average LTC cost reference data (2024, in today's dollars).
 * Source: Genworth 2023/2024 Cost of Care Survey (planning-grade reference).
 */
export const LTC_NATIONAL_AVERAGES_2024 = {
  homeHealthAide_annual: 61776,
  assistedLiving_annual: 64200,
  memoryCare_annual: 86000,
  nursingHomeSemiPrivate_annual: 104000,
  nursingHomePrivate_annual: 116800,
};

export interface LongTermCareStressResult {
  ltcCost: number;
  ltcActive: boolean;
  yearsRemaining: number;
  cumulativeLtcCost: number;
}

/**
 * Compute LTC cost for a given year with cumulative tracking.
 */
export function computeLtcStressResult(
  config: LongTermCareStressConfig,
  primaryAge: number,
  year: number,
  baseYear: number,
  healthcareInflationRate: number,
  previousCumulativeCost: number = 0,
): LongTermCareStressResult {
  if (!config.enabled) {
    return {
      ltcCost: 0,
      ltcActive: false,
      yearsRemaining: 0,
      cumulativeLtcCost: previousCumulativeCost,
    };
  }

  const endAge = config.startAge + config.durationYears;
  const isActive = primaryAge >= config.startAge && primaryAge < endAge;

  if (!isActive) {
    const yearsRemaining = primaryAge < config.startAge ? config.durationYears : 0;
    return {
      ltcCost: 0,
      ltcActive: false,
      yearsRemaining,
      cumulativeLtcCost: previousCumulativeCost,
    };
  }

  const ltcCost = inflateHealthcareCost(config.annualCost, year, baseYear, healthcareInflationRate);
  const yearsRemaining = endAge - primaryAge - 1;

  return {
    ltcCost,
    ltcActive: true,
    yearsRemaining,
    cumulativeLtcCost: previousCumulativeCost + ltcCost,
  };
}

/**
 * Summarize total LTC stress cost over the entire projection.
 */
export function summarizeLtcStress(
  config: LongTermCareStressConfig,
  startYear: number,
  primaryAgeAtStart: number,
  healthcareInflationRate: number,
): { totalLtcCost: number; activeYears: number; peakAnnualCost: number } {
  if (!config.enabled) return { totalLtcCost: 0, activeYears: 0, peakAnnualCost: 0 };

  let totalLtcCost = 0;
  let peakAnnualCost = 0;

  for (let i = 0; i < config.durationYears; i++) {
    const yearsFromNow = config.startAge - primaryAgeAtStart + i;
    if (yearsFromNow < 0) continue;
    const year = startYear + yearsFromNow;
    const cost = inflateHealthcareCost(config.annualCost, year, startYear, healthcareInflationRate);
    totalLtcCost += cost;
    if (cost > peakAnnualCost) peakAnnualCost = cost;
  }

  return { totalLtcCost, activeYears: config.durationYears, peakAnnualCost };
}
