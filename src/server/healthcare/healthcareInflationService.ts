/**
 * Healthcare Inflation Service
 *
 * Centralizes all healthcare cost growth assumptions.
 * Healthcare costs typically outpace general inflation.
 *
 * Default: 5% annual healthcare inflation (vs ~2.5% general inflation).
 * This is configurable per analysis run.
 *
 * Planning-grade estimate only. Actual healthcare inflation varies significantly.
 */

import { DEFAULT_HEALTHCARE_INFLATION, DEFAULT_GENERAL_INFLATION } from './types';

/**
 * Apply healthcare inflation to a base-year cost amount.
 */
export function inflateHealthcareCost(
  baseAmount: number,
  year: number,
  baseYear: number,
  healthcareInflationRate: number = DEFAULT_HEALTHCARE_INFLATION,
): number {
  const yearsFromBase = Math.max(0, year - baseYear);
  return baseAmount * Math.pow(1 + healthcareInflationRate, yearsFromBase);
}

/**
 * Compute the healthcare inflation premium over general inflation.
 * Useful for explaining to users why healthcare costs grow faster.
 */
export function healthcareInflationPremium(
  healthcareInflationRate: number = DEFAULT_HEALTHCARE_INFLATION,
  generalInflationRate: number = DEFAULT_GENERAL_INFLATION,
): number {
  return healthcareInflationRate - generalInflationRate;
}

/**
 * Compute effective annual healthcare cost growth factor for a given year.
 */
export function healthcareGrowthFactor(
  year: number,
  baseYear: number,
  healthcareInflationRate: number = DEFAULT_HEALTHCARE_INFLATION,
): number {
  const yearsFromBase = Math.max(0, year - baseYear);
  return Math.pow(1 + healthcareInflationRate, yearsFromBase);
}

/**
 * Estimate total lifetime healthcare spending (sum of inflated annual costs).
 * Useful for summary display.
 */
export function estimateLifetimeHealthcareCost(
  baseAnnualCost: number,
  startYear: number,
  endYear: number,
  healthcareInflationRate: number = DEFAULT_HEALTHCARE_INFLATION,
): number {
  let total = 0;
  for (let year = startYear; year <= endYear; year++) {
    total += inflateHealthcareCost(baseAnnualCost, year, startYear, healthcareInflationRate);
  }
  return total;
}

/**
 * Describe the healthcare inflation assumption in plain English.
 */
export function describeHealthcareInflation(rate: number): string {
  const pct = (rate * 100).toFixed(1);
  const premium = ((rate - DEFAULT_GENERAL_INFLATION) * 100).toFixed(1);
  return `${pct}% annual healthcare inflation (${premium}% above assumed general inflation)`;
}
