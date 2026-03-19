// Medicare-era healthcare cost estimation

import {
  MEDICARE_2024,
  IRMAA_THRESHOLDS,
  type MedicareHealthcareCosts,
  type FilingStatusForHealthcare,
} from './types';

export interface MedicareCostInput {
  config: MedicareHealthcareCosts;
  personAge: number;
  medicareEligibilityAge: number;
  grossIncomeForIRMAA: number;    // Gross income for IRMAA surcharge estimation
  filingStatus: FilingStatusForHealthcare;
  year: number;
  baseYear: number;
  healthcareInflationRate: number;
  useAdvantage?: boolean;         // MA vs Medigap (default: Medigap)
}

function inflateAmount(amount: number, year: number, baseYear: number, rate: number): number {
  const years = Math.max(0, year - baseYear);
  return amount * Math.pow(1 + rate, years);
}

/**
 * Estimate annual Medicare cost for a single person in a given year.
 * Returns 0 if person is not yet Medicare-eligible.
 */
export function estimateMedicareCost(input: MedicareCostInput): number {
  const {
    config,
    personAge,
    medicareEligibilityAge,
    year,
    baseYear,
    healthcareInflationRate,
  } = input;

  if (personAge < medicareEligibilityAge) return 0;

  if (!config.includePartB && !config.includePartD && !config.includeMedigapOrAdvantage) {
    // Bare minimum: just OOP
    return inflateAmount(config.additionalAnnualOOP, year, baseYear, healthcareInflationRate);
  }

  const yearsFromBase = Math.max(0, year - baseYear);
  const f = Math.pow(1 + healthcareInflationRate, yearsFromBase);

  let monthlyTotal = 0;

  if (config.includePartB) {
    monthlyTotal += MEDICARE_2024.partB_premium_monthly * f;
    // IRMAA surcharge (simplified: add 40% if income > threshold)
    const irmaaThreshold =
      input.filingStatus === 'MARRIED_FILING_JOINTLY'
        ? IRMAA_THRESHOLDS.MARRIED_FILING_JOINTLY
        : IRMAA_THRESHOLDS.SINGLE;
    if (input.grossIncomeForIRMAA > irmaaThreshold) {
      monthlyTotal += MEDICARE_2024.partB_premium_monthly * f * 0.40; // IRMAA tier 1 surcharge ~40%
    }
  }

  if (config.includePartD) {
    monthlyTotal += MEDICARE_2024.partD_premium_monthly * f;
  }

  if (config.includeMedigapOrAdvantage) {
    if (input.useAdvantage) {
      monthlyTotal += MEDICARE_2024.advantage_monthly * f;
    } else {
      monthlyTotal += MEDICARE_2024.medigap_monthly * f;
    }
  }

  const annualPremiums = monthlyTotal * 12;
  const annualOOP = inflateAmount(
    config.additionalAnnualOOP + (config.includePartB ? MEDICARE_2024.oop_dental_vision_annual : 0),
    year,
    baseYear,
    healthcareInflationRate,
  );

  return annualPremiums + annualOOP;
}
