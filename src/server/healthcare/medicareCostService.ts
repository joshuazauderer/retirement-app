/**
 * Medicare Cost Service
 *
 * Models planning-grade Medicare-era healthcare costs.
 * Covers Part B, Part D, Medigap/Advantage, and out-of-pocket.
 *
 * 2024 Medicare premium baselines; inflated forward using healthcare inflation rate.
 * IRMAA surcharge estimated at planning-grade (single tier).
 *
 * Planning-grade estimates only. Not Medicare enrollment advice.
 */

export { estimateMedicareCost } from './medicareService';
export type { MedicareCostInput } from './medicareService';

import { estimateMedicareCost } from './medicareService';
import { IRMAA_THRESHOLDS } from './types';
import type { MedicareHealthcareCosts, FilingStatusForHealthcare } from './types';

/**
 * Compute the planning-grade annual Medicare baseline for a household.
 * Handles couple households where one or both are Medicare-eligible.
 */
export function computeHouseholdMedicareCost(params: {
  config: MedicareHealthcareCosts;
  primaryAge: number;
  spouseAge: number | undefined;
  medicareEligibilityAge: number;
  includeSpouse: boolean;
  grossIncome: number;
  filingStatus: FilingStatusForHealthcare;
  year: number;
  baseYear: number;
  healthcareInflationRate: number;
}): { primaryCost: number; spouseCost: number; total: number } {
  const primaryCost = estimateMedicareCost({
    config: params.config,
    personAge: params.primaryAge,
    medicareEligibilityAge: params.medicareEligibilityAge,
    grossIncomeForIRMAA: params.grossIncome,
    filingStatus: params.filingStatus,
    year: params.year,
    baseYear: params.baseYear,
    healthcareInflationRate: params.healthcareInflationRate,
  });

  let spouseCost = 0;
  if (params.includeSpouse && params.spouseAge != null) {
    spouseCost = estimateMedicareCost({
      config: params.config,
      personAge: params.spouseAge,
      medicareEligibilityAge: params.medicareEligibilityAge,
      grossIncomeForIRMAA: params.grossIncome,
      filingStatus: params.filingStatus,
      year: params.year,
      baseYear: params.baseYear,
      healthcareInflationRate: params.healthcareInflationRate,
    });
  }

  return { primaryCost, spouseCost, total: primaryCost + spouseCost };
}

/**
 * Get a plain-English description of what Medicare costs are being modeled.
 */
export function describeMedicareCoverageConfig(config: MedicareHealthcareCosts): string[] {
  const lines: string[] = [];
  if (config.includePartB) lines.push('Medicare Part B (medical insurance)');
  if (config.includePartD) lines.push('Medicare Part D (prescription drug coverage)');
  if (config.includeMedigapOrAdvantage) lines.push('Medigap / Medicare Advantage supplement');
  if (config.additionalAnnualOOP > 0) {
    lines.push(`Additional out-of-pocket: $${config.additionalAnnualOOP.toLocaleString()}/yr`);
  }
  return lines;
}

/**
 * Check if IRMAA surcharge applies based on income and filing status.
 */
export function isIRMAASurchargeApplicable(
  grossIncome: number,
  filingStatus: FilingStatusForHealthcare,
): boolean {
  const threshold =
    filingStatus === 'MARRIED_FILING_JOINTLY'
      ? IRMAA_THRESHOLDS.MARRIED_FILING_JOINTLY
      : IRMAA_THRESHOLDS.SINGLE;
  return grossIncome > threshold;
}
