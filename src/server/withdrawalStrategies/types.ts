/**
 * Phase 7 — Withdrawal Strategy Engine + Sequence Risk Analysis
 *
 * Centralized types for withdrawal policies, ordering, and sequence risk.
 *
 * v1 Limitations:
 * - Annual time-step model only (no monthly decumulation)
 * - Planning-grade flat-rate tax assumptions
 * - Simplified guardrail: portfolio-health ratio vs thresholds (not a branded framework)
 * - No full tax optimization, RMD compliance, or annuity modeling
 * - No AI interpretation
 */

// ---------------------------------------------------------------------------
// Strategy + ordering enums
// ---------------------------------------------------------------------------

export type WithdrawalStrategyType =
  | 'NEEDS_BASED'               // withdraw exactly the cash-flow gap (current engine default)
  | 'FIXED_NOMINAL'             // fixed dollar amount, nominally constant each year
  | 'FIXED_REAL'                // fixed dollar amount in today's dollars, inflated annually
  | 'INFLATION_ADJUSTED_SPENDING' // spending grows with inflation; named alias for NEEDS_BASED with explicit inflation link
  | 'GUARDRAIL';                // simplified portfolio-health guardrail adjustments

export type WithdrawalOrderingType =
  | 'TAXABLE_FIRST'             // TAXABLE → TAX_DEFERRED → TAX_FREE → MIXED (default)
  | 'TAX_DEFERRED_FIRST'        // TAX_DEFERRED → TAXABLE → TAX_FREE → MIXED
  | 'TAX_FREE_FIRST'            // TAX_FREE → TAXABLE → TAX_DEFERRED → MIXED
  | 'PRO_RATA';                 // proportional across all investable accounts

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

/**
 * Guardrail parameters for the GUARDRAIL strategy.
 *
 * All monetary amounts are in current (today's) dollars.
 * All thresholds are expressed as a fraction of the initial retirement portfolio value.
 *
 * Example: lowerGuardrailPct=0.80 means "if portfolio < 80% of initial value, reduce spending".
 */
export interface GuardrailConfig {
  /** Starting annual withdrawal target in today's dollars. */
  initialAnnualWithdrawal: number;
  /** Portfolio-value fraction below which a spending cut triggers (e.g. 0.80). */
  lowerGuardrailPct: number;
  /** Portfolio-value fraction above which a spending increase is permitted (e.g. 1.50). */
  upperGuardrailPct: number;
  /** Fractional reduction applied when below lower guardrail (e.g. 0.10 = cut 10%). */
  decreaseStepPct: number;
  /** Fractional increase permitted when above upper guardrail (e.g. 0.05 = raise 5%). */
  increaseStepPct: number;
  /** Absolute floor: withdrawal never drops below this, regardless of portfolio health. Today's dollars. */
  floorAnnualWithdrawal: number;
  /** Ceiling expressed as a multiple of initialAnnualWithdrawal (e.g. 1.5 = 150% cap). */
  ceilingMultiplier: number;
}

export interface WithdrawalStrategyConfig {
  strategyType: WithdrawalStrategyType;
  orderingType: WithdrawalOrderingType;
  /** Annual withdrawal target in current dollars. Required for FIXED_NOMINAL, FIXED_REAL. */
  annualWithdrawalTarget?: number;
  /** Required when strategyType === 'GUARDRAIL'. */
  guardrailConfig?: GuardrailConfig;
  /** Human-readable label for this configuration. */
  label?: string;
}

// ---------------------------------------------------------------------------
// Per-year policy instruction (from policy engine → cash-flow engine)
// ---------------------------------------------------------------------------

export interface WithdrawalYearInstruction {
  year: number;
  /** The target withdrawal amount to source from accounts this year. */
  targetWithdrawal: number;
  /** True if the target equals the needs-based cash-flow gap. */
  isNeedsBased: boolean;
  /** True if a guardrail adjustment fired this year. */
  guardrailActive: boolean;
  /** Direction of guardrail adjustment. */
  guardrailDirection: 'none' | 'reduced' | 'increased';
  /** Cumulative inflation factor vs. the policy baseline year. */
  inflationFactor: number;
}

// ---------------------------------------------------------------------------
// Run input / output types
// ---------------------------------------------------------------------------

export interface WithdrawalStrategyRunInput {
  householdId: string;
  scenarioId: string;
  config: WithdrawalStrategyConfig;
  label?: string;
  /**
   * When provided, overrides per-year portfolio returns (sequence-risk stress paths).
   * Index 0 = first projection year. null entries use the baseline expected return.
   */
  annualReturnOverrides?: (number | null)[];
  /** True for stress-test runs (stored separately, not shown in main list by default). */
  isStressRun?: boolean;
  stressPathId?: string;
}

export interface WithdrawalYearResult {
  year: number;
  beginningAssets: number;
  /** Target from the withdrawal policy (may differ from needs-based gap). */
  requestedWithdrawal: number;
  /** Amount actually sourced from accounts (≤ requested if depleted). */
  actualWithdrawal: number;
  withdrawalByBucket: { taxable: number; taxDeferred: number; taxFree: number };
  withdrawalByAccount: Record<string, number>;
  shortfall: number;
  expenses: number;
  benefits: number;
  taxes: number;
  endingAssets: number;
  depleted: boolean;
  guardrailDirection: 'none' | 'reduced' | 'increased';
}

export interface WithdrawalStrategyRunResult {
  runId: string;
  householdId: string;
  scenarioId: string;
  scenarioName: string;
  config: WithdrawalStrategyConfig;
  label: string;
  createdAt: string;
  isStressRun: boolean;
  stressPathId: string | null;
  // Summary
  success: boolean;
  firstDepletionYear: number | null;
  firstRetirementYear: number | null;
  endingAssets: number;
  endingNetWorth: number;
  totalWithdrawals: number;
  totalTaxes: number;
  averageAnnualWithdrawal: number;
  maxAnnualWithdrawal: number;
  yearsFullyFunded: number;
  projectionStartYear: number;
  projectionEndYear: number;
  // Year-by-year
  yearByYear: WithdrawalYearResult[];
}

export interface WithdrawalStrategySummaryItem {
  runId: string;
  scenarioName: string;
  strategyType: WithdrawalStrategyType;
  orderingType: WithdrawalOrderingType;
  label: string;
  success: boolean;
  firstDepletionYear: number | null;
  endingAssets: number;
  totalWithdrawals: number;
  isStressRun: boolean;
  stressPathId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Comparison types
// ---------------------------------------------------------------------------

export interface WithdrawalStrategyComparisonResult {
  runA: WithdrawalStrategyRunResult;
  runB: WithdrawalStrategyRunResult;
  configDiffs: Array<{ label: string; a: string; b: string }>;
  outcomeDiffs: Array<{
    label: string;
    a: string;
    b: string;
    delta: string;
    direction: 'better' | 'worse' | 'neutral';
  }>;
}

// ---------------------------------------------------------------------------
// Sequence risk types
// ---------------------------------------------------------------------------

/**
 * A named return-override path used for sequence-risk stress testing.
 *
 * annualReturnOverrides is indexed from projection start (year 0 = first sim year).
 * null entries mean "use baseline expected return for this year".
 *
 * These are pre-defined in sequenceRiskStressService.ts and should not be
 * hardcoded in page components.
 */
export interface StressPath {
  id: string;
  label: string;
  description: string;
  /** Sparse return vector from projection start. null = use baseline. */
  annualReturnOverrides: (number | null)[];
}

export interface SequenceRiskRunResult {
  stressPath: StressPath;
  result: WithdrawalStrategyRunResult;
  depletionYearDelta: number | null; // positive = depletes sooner under stress
  endingAssetDelta: number;           // negative = ends with less under stress
  /** Years where stress scenario had shortfall but baseline did not. */
  vulnerableYears: number[];
}

export interface SequenceRiskStressResult {
  baseline: WithdrawalStrategyRunResult;
  stressResults: SequenceRiskRunResult[];
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

export interface WithdrawalStrategyValidation {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Bounds / defaults
// ---------------------------------------------------------------------------

export const WS_BOUNDS = {
  MIN_WITHDRAWAL: 0,
  MAX_WITHDRAWAL: 10_000_000,
  DEFAULT_ORDERING: 'TAXABLE_FIRST' as WithdrawalOrderingType,
  DEFAULT_STRATEGY: 'NEEDS_BASED' as WithdrawalStrategyType,
  GUARDRAIL_LOWER_DEFAULT: 0.80,
  GUARDRAIL_UPPER_DEFAULT: 1.50,
  GUARDRAIL_DECREASE_DEFAULT: 0.10,
  GUARDRAIL_INCREASE_DEFAULT: 0.05,
  GUARDRAIL_CEILING_DEFAULT: 1.50,
  ENGINE_VERSION: '1.0.0',
} as const;
