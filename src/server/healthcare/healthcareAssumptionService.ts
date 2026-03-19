/**
 * Healthcare Assumption Service
 *
 * Responsible for:
 * - Loading and validating healthcare assumptions for a run
 * - Determining which healthcare cost rules apply by member/year
 * - Exposing effective healthcare settings for a projection run
 *
 * Planning-grade estimates only. Not medical or insurance advice.
 */

import type { HealthcarePlanningInput, MemberHealthcareProfile } from './types';
import type { SimulationSnapshot } from '../simulation/types';
import { DEFAULT_HEALTHCARE_INFLATION, MEDICARE_2024 } from './types';

export interface EffectiveHealthcareAssumptions {
  healthcareInflationRate: number;
  medicareEligibilityAge: number;
  preMedicareAnnualCost: number;           // Total annual cost per pre-Medicare person
  medicareAnnualCostBaseline: number;      // Total annual cost per Medicare-eligible person
  ltcEnabled: boolean;
  ltcStartAge: number;
  ltcDurationYears: number;
  ltcAnnualCost: number;
  longevityEnabled: boolean;
  longevityTargetAge: number;
  longevityPerson: 'primary' | 'spouse' | 'both';
  includeSpouseHealthcare: boolean;
  memberProfiles: MemberHealthcareProfile[];
}

/**
 * Load effective healthcare assumptions from input config and snapshot.
 * Applies documented defaults where config is missing.
 */
export function loadEffectiveHealthcareAssumptions(
  input: HealthcarePlanningInput,
  snapshot: SimulationSnapshot,
): EffectiveHealthcareAssumptions {
  const healthcareInflationRate = input.healthcareInflationRate ?? DEFAULT_HEALTHCARE_INFLATION;
  const medicareEligibilityAge = input.medicareEligibilityAge ?? 65;

  // Pre-Medicare planning-grade baseline if not specified
  const preMedicareAnnualCost =
    (input.preMedicare.annualPremium ?? 0) + (input.preMedicare.annualOutOfPocket ?? 0);

  // Medicare baseline: Part B + Part D + Medigap + OOP (annual)
  const medicareAnnualCostBaseline =
    (MEDICARE_2024.partB_premium_monthly * 12) +
    (input.medicare.includePartD ? MEDICARE_2024.partD_premium_monthly * 12 : 0) +
    (input.medicare.includeMedigapOrAdvantage ? MEDICARE_2024.medigap_monthly * 12 : 0) +
    (input.medicare.additionalAnnualOOP ?? MEDICARE_2024.oop_dental_vision_annual);

  // Build member profiles from snapshot
  const memberProfiles: MemberHealthcareProfile[] = buildMemberProfiles(snapshot, medicareEligibilityAge);

  return {
    healthcareInflationRate,
    medicareEligibilityAge,
    preMedicareAnnualCost,
    medicareAnnualCostBaseline,
    ltcEnabled: input.ltcStress?.enabled ?? false,
    ltcStartAge: input.ltcStress?.startAge ?? 82,
    ltcDurationYears: input.ltcStress?.durationYears ?? 3,
    ltcAnnualCost: input.ltcStress?.annualCost ?? 90000,
    longevityEnabled: input.longevityStress?.enabled ?? false,
    longevityTargetAge: input.longevityStress?.targetAge ?? 95,
    longevityPerson: input.longevityStress?.person ?? 'primary',
    includeSpouseHealthcare: input.includeSpouseHealthcare ?? false,
    memberProfiles,
  };
}

/**
 * Determine which healthcare cost mode applies for a member at a given age.
 */
export type HealthcareCostMode = 'pre_medicare' | 'medicare' | 'none';

export function getHealthcareCostMode(
  memberAge: number,
  medicareEligibilityAge: number,
  isAlive: boolean,
): HealthcareCostMode {
  if (!isAlive) return 'none';
  if (memberAge >= medicareEligibilityAge) return 'medicare';
  return 'pre_medicare';
}

/**
 * Build member healthcare profiles from snapshot.
 */
function buildMemberProfiles(
  snapshot: SimulationSnapshot,
  medicareEligibilityAge: number,
): MemberHealthcareProfile[] {
  if (!snapshot.members || snapshot.members.length === 0) return [];

  return snapshot.members.map((member) => ({
    memberId: member.memberId,
    currentAge: member.currentAge,
    medicareEligibilityAge,
    isPrimary: member.isPrimary,
    isSpouse: !member.isPrimary,
  }));
}

/**
 * Validate that healthcare assumptions are internally consistent.
 */
export function validateHealthcareAssumptions(
  assumptions: EffectiveHealthcareAssumptions,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (assumptions.healthcareInflationRate > 0.10) {
    warnings.push('Healthcare inflation rate above 10% is unusually high for planning purposes.');
  }
  if (assumptions.ltcEnabled && assumptions.ltcAnnualCost > 300000) {
    warnings.push('LTC annual cost above $300,000 is above national high-end estimates; verify this is intentional.');
  }
  if (assumptions.longevityEnabled && assumptions.longevityTargetAge > 105) {
    warnings.push('Longevity target above 105 is beyond typical planning horizons.');
  }

  return { valid: true, warnings }; // Warnings are advisory; don't block the run
}
