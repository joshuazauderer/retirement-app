// Healthcare cost integration into annual cash-flow loop

import { getPreMedicareCostForYear } from './preMedicareService';
import { estimateMedicareCost } from './medicareService';
import { getLtcCostForYear } from './ltcStressService';
import type { HealthcarePlanningInput } from './types';
import type { SimulationSnapshot } from '../simulation/types';

export interface HealthcareCashFlowYearInput {
  year: number;
  primaryAge: number;
  spouseAge?: number;
  grossIncome: number;            // For IRMAA estimation
  snapshot: SimulationSnapshot;
  config: HealthcarePlanningInput;
  baseYear: number;
  accountBalances: Record<string, number>;
}

export interface HealthcareCashFlowYearOutput {
  totalHealthcareCost: number;
  primaryPreMedicareCost: number;
  primaryMedicareCost: number;
  spousePreMedicareCost: number;
  spouseMedicareCost: number;
  ltcCost: number;
  primaryOnMedicare: boolean;
  spouseOnMedicare: boolean;
  ltcActive: boolean;
}

/**
 * Compute total healthcare cost for a single year including all components.
 */
export function computeHealthcareCostForYear(
  input: HealthcareCashFlowYearInput,
): HealthcareCashFlowYearOutput {
  const { year, primaryAge, spouseAge, grossIncome, config, baseYear } = input;
  const {
    preMedicare,
    medicare,
    healthcareInflationRate,
    medicareEligibilityAge,
    ltcStress,
    includeSpouseHealthcare,
  } = config;

  // Use household filing status for IRMAA if available, simplified otherwise
  const filingStatus = 'SINGLE' as const;

  // Primary: Pre-Medicare
  const primaryPreMedicareCost = getPreMedicareCostForYear(
    preMedicare,
    primaryAge,
    medicareEligibilityAge,
    year,
    baseYear,
    healthcareInflationRate,
  );

  // Primary: Medicare
  const primaryOnMedicare = primaryAge >= medicareEligibilityAge;
  const primaryMedicareCost = estimateMedicareCost({
    config: medicare,
    personAge: primaryAge,
    medicareEligibilityAge,
    grossIncomeForIRMAA: grossIncome,
    filingStatus,
    year,
    baseYear,
    healthcareInflationRate,
  });

  // Spouse costs
  let spousePreMedicareCost = 0;
  let spouseMedicareCost = 0;
  let spouseOnMedicare = false;

  if (includeSpouseHealthcare && spouseAge != null) {
    spousePreMedicareCost = getPreMedicareCostForYear(
      preMedicare,
      spouseAge,
      medicareEligibilityAge,
      year,
      baseYear,
      healthcareInflationRate,
    );
    spouseOnMedicare = spouseAge >= medicareEligibilityAge;
    spouseMedicareCost = estimateMedicareCost({
      config: medicare,
      personAge: spouseAge,
      medicareEligibilityAge,
      grossIncomeForIRMAA: grossIncome,
      filingStatus,
      year,
      baseYear,
      healthcareInflationRate,
    });
  }

  // LTC stress
  const ltcResult = getLtcCostForYear(
    ltcStress,
    primaryAge,
    year,
    baseYear,
    healthcareInflationRate,
  );

  const totalHealthcareCost =
    primaryPreMedicareCost +
    primaryMedicareCost +
    spousePreMedicareCost +
    spouseMedicareCost +
    ltcResult.ltcCost;

  return {
    totalHealthcareCost,
    primaryPreMedicareCost,
    primaryMedicareCost,
    spousePreMedicareCost,
    spouseMedicareCost,
    ltcCost: ltcResult.ltcCost,
    primaryOnMedicare,
    spouseOnMedicare,
    ltcActive: ltcResult.ltcActive,
  };
}
