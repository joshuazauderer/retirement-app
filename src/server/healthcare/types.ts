/**
 * Phase 10 — Healthcare Cost Modeling + Longevity Stress Testing Layer
 *
 * v1 Limitations (planning-grade, not actuarial):
 * - Medicare premiums based on 2024 values inflated forward at healthcare inflation rate
 * - IRMAA is simplified (tier 1 surcharge only)
 * - LTC costs are deterministic (not stochastic)
 * - No Medicaid modeling
 * - Not medical or insurance advice — planning estimates only
 */

export type FilingStatusForHealthcare =
  | 'SINGLE'
  | 'MARRIED_FILING_JOINTLY'
  | 'HEAD_OF_HOUSEHOLD'
  | 'MARRIED_FILING_SEPARATELY';

export interface PreMedicareHealthcareCosts {
  annualPremium: number;          // Individual/family premium (employer + employee, full if self-pay)
  annualOutOfPocket: number;      // Expected annual OOP (deductibles, copays)
  cobrapMonths?: number;          // Months of COBRA before marketplace
  marketplacePlanTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface MedicareHealthcareCosts {
  includePartB: boolean;          // Standard Part B (default true)
  includePartD: boolean;          // Prescription drug
  includeMedigapOrAdvantage: boolean; // Supplement or MA plan
  additionalAnnualOOP: number;    // Expected dental, vision, hearing, copays above Medicare
}

export interface LongTermCareStressConfig {
  enabled: boolean;
  startAge: number;               // Age at which LTC costs begin
  durationYears: number;          // How many years the cost spike lasts
  annualCost: number;             // Annual LTC cost in today's dollars
  probability?: number;           // For display only; not used in simulation
}

export interface LongevityStressConfig {
  enabled: boolean;
  targetAge: number;              // 90, 95, 100, or custom
  person: 'primary' | 'spouse' | 'both';
}

export interface HealthcarePlanningInput {
  householdId: string;
  scenarioId: string;
  label: string;

  // Pre-Medicare
  preMedicare: PreMedicareHealthcareCosts;
  medicareEligibilityAge: number;       // Usually 65

  // Medicare-era
  medicare: MedicareHealthcareCosts;

  // Healthcare inflation
  healthcareInflationRate: number;      // e.g. 0.05 = 5% annual; default 0.05

  // LTC stress
  ltcStress: LongTermCareStressConfig;

  // Longevity stress (extends ages in snapshot)
  longevityStress: LongevityStressConfig;

  // Survivor integration
  includeSpouseHealthcare: boolean;     // Apply costs for spouse separately
}

export interface HealthcareYearResult {
  year: number;
  age: number;
  spouseAge?: number;

  // Costs
  primaryPreMedicareCost: number;
  primaryMedicareCost: number;
  spousePreMedicareCost: number;
  spouseMedicareCost: number;
  ltcCost: number;
  totalHealthcareCost: number;

  // Plan state
  primaryOnMedicare: boolean;
  spouseOnMedicare: boolean;
  ltcActive: boolean;

  // Financial impact
  endingAssets: number;
  depleted: boolean;
}

export interface HealthcarePlanningRunSummary {
  projectionStartYear: number;
  projectionEndYear: number;

  totalHealthcareCost: number;
  totalPreMedicareCost: number;
  totalMedicareCost: number;
  totalLtcCost: number;

  peakAnnualHealthcareCost: number;
  peakHealthcareCostYear: number;

  endingAssets: number;
  success: boolean;
  firstDepletionYear?: number;

  averageAnnualHealthcareCost: number;
  longevityExtensionYears: number;    // How many years beyond base timeline
}

export interface HealthcarePlanningRunResult {
  runId: string;
  label: string;
  scenarioName: string;
  createdAt: string;

  summary: HealthcarePlanningRunSummary;
  yearByYear: HealthcareYearResult[];
  config: HealthcarePlanningInput;
}

export interface HealthcarePlanningSummaryItem {
  runId: string;
  label: string;
  scenarioName: string;
  createdAt: string;
  totalHealthcareCost: number;
  endingAssets: number;
  success: boolean;
  firstDepletionYear?: number;
  hasLtcStress: boolean;
  hasLongevityStress: boolean;
  longevityTargetAge?: number;
}

export interface HealthcareComparisonResult {
  runA: { runId: string; label: string };
  runB: { runId: string; label: string };
  configDiffs: Array<{ label: string; a: string; b: string }>;
  outcomeDiffs: Array<{ label: string; a: string; b: string; delta: string; direction: 'better' | 'worse' | 'neutral' }>;
  yearByYearDelta: Array<{ year: number; costA: number; costB: number; delta: number }>;
}

export interface HealthcarePlanningValidation {
  valid: boolean;
  errors: string[];
}

// Medicare 2024 baseline costs (in today's dollars; inflated forward in engine)
export const MEDICARE_2024 = {
  partB_premium_monthly: 174.70,        // Standard Part B 2024
  partD_premium_monthly: 35.00,         // Average Part D benchmark
  medigap_monthly: 150.00,              // Mid-range Medigap/MA supplement estimate
  advantage_monthly: 20.00,             // Average MA plan premium (lower than Medigap)
  oop_dental_vision_annual: 1200,       // Dental, vision, hearing OOP
};

// IRMAA thresholds (simplified — planning grade)
// For 2024: Part B premium surcharge for income > $103k (single) or $206k (MFJ)
export const IRMAA_THRESHOLDS = {
  SINGLE: 103000,
  MARRIED_FILING_JOINTLY: 206000,
};

export const DEFAULT_HEALTHCARE_INFLATION = 0.05; // 5% per year
export const DEFAULT_GENERAL_INFLATION = 0.025;
