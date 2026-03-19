/**
 * Phase 9 — Tax Modeling Layer
 *
 * Centralized type definitions for all tax services.
 *
 * v1 Limitations (planning-grade, not filing-grade):
 * - Annual time-step model only
 * - Federal brackets based on 2024 values, inflated forward by assumed inflation rate
 * - Simplified per-state flat effective rate (not full bracket replication for every state)
 * - Simplified Social Security taxation approximation (matches IRS provisional income logic)
 * - Capital gains basis tracking uses initial assumption ratio when cost basis is unknown
 * - No AMT, no NIIT threshold modeling, no RMD enforcement
 * - Not tax preparation software — planning estimates only
 */

// ---------------------------------------------------------------------------
// Filing status
// ---------------------------------------------------------------------------

export type FilingStatusType =
  | 'SINGLE'
  | 'MARRIED_FILING_JOINTLY'
  | 'MARRIED_FILING_SEPARATELY'
  | 'HEAD_OF_HOUSEHOLD';

// ---------------------------------------------------------------------------
// Tax bracket structures
// ---------------------------------------------------------------------------

export interface TaxBracket {
  /** Minimum taxable income for this bracket (inclusive). */
  min: number;
  /** Maximum taxable income for this bracket (exclusive). Use Infinity for the top bracket. */
  max: number;
  /** Marginal rate as a decimal (e.g. 0.22 = 22%). */
  rate: number;
}

export interface FilingStatusBrackets {
  ordinary: TaxBracket[];
  capitalGains: TaxBracket[];
  standardDeduction: number;
}

// ---------------------------------------------------------------------------
// Tax assumptions (configuration for a tax-planning run)
// ---------------------------------------------------------------------------

export interface RothConversionConfig {
  /** Annual Roth conversion amount in today's dollars (year of the run). */
  annualConversionAmount: number;
  /** First calendar year of conversions. */
  startYear: number;
  /** Last calendar year of conversions (inclusive). */
  endYear: number;
  /** If true, inflate the conversion amount by the assumed inflation rate each year. */
  inflateWithInflation: boolean;
}

export interface TaxAssumptions {
  filingStatus: FilingStatusType;
  stateOfResidence: string;
  /**
   * Fraction of each taxable-account balance that represents cost basis at run start.
   * 1.0 = all basis (0% unrealized gain). 0.60 = 60% basis, 40% unrealized gain.
   * Default: 0.60.
   */
  capitalGainsBasisRatio: number;
  /** Roth conversion strategy, if any. */
  rothConversion?: RothConversionConfig;
  /** Base year for bracket values (2024). Brackets are inflated forward from this year. */
  bracketBaseYear: number;
}

// ---------------------------------------------------------------------------
// Per-year tax component results
// ---------------------------------------------------------------------------

export interface SocialSecurityTaxResult {
  /** Total SS benefits received this year. */
  ssBenefits: number;
  /** Estimated provisional income (AGI proxy + 50% SS). */
  provisionalIncome: number;
  /** Fraction of SS benefits that are taxable (0, 0.50, or up to 0.85). */
  taxablePercentage: number;
  /** Dollar amount of SS benefits included in ordinary income. */
  taxableSsAmount: number;
}

export interface CapitalGainsApproximationResult {
  /** Gross withdrawal from taxable accounts this year. */
  taxableWithdrawal: number;
  /** Estimated portion that is long-term capital gain. */
  estimatedGainAmount: number;
  /** Estimated portion that is return of cost basis (not taxable as income). */
  basisPortion: number;
  /** Capital gains rate applied (0, 0.15, or 0.20). */
  capitalGainsRate: number;
  /** Estimated capital gains tax for this year. */
  estimatedCapitalGainsTax: number;
}

export interface FederalTaxResult {
  /** All income components before deductions. */
  grossIncome: number;
  /** Ordinary taxable income after standard deduction. */
  ordinaryTaxableIncome: number;
  /** Long-term capital gains income (taxed at preferential rates). */
  capitalGainsIncome: number;
  /** Taxable portion of Social Security benefits included in ordinary income. */
  ssTaxableAmount: number;
  /** Roth conversion amount included in ordinary income. */
  rothConversionAmount: number;
  /** Standard deduction applied. */
  standardDeduction: number;
  /** Federal tax on ordinary income (brackets). */
  federalOrdinaryTax: number;
  /** Federal capital gains tax (preferential rates). */
  capitalGainsTax: number;
  /** Total federal tax = ordinary + capital gains. */
  totalFederalTax: number;
  effectiveFederalRate: number;
  marginalFederalRate: number;
}

export interface StateTaxResult {
  stateOfResidence: string;
  taxableIncome: number;
  /** Flat effective state rate used (planning-grade simplification). */
  stateRate: number;
  stateTax: number;
}

export interface AnnualTaxBreakdown {
  year: number;
  filingStatus: FilingStatusType;
  // --- Income components ---
  earnedIncome: number;
  /** Total SS/pension/other benefits income. */
  benefitsIncome: number;
  /** Social Security gross amount within benefitsIncome. */
  ssBenefits: number;
  /** Taxable portion of Social Security. */
  ssTaxableAmount: number;
  /** Gross withdrawal from tax-deferred accounts (pre-gross-up basis). */
  taxDeferredWithdrawal: number;
  /** Gross withdrawal from taxable brokerage accounts. */
  taxableWithdrawal: number;
  /** Withdrawal from tax-free (Roth) accounts — not taxed. */
  taxFreeWithdrawal: number;
  /** Roth conversion amount added to ordinary income. */
  rothConversionAmount: number;
  // --- Capital gains ---
  capitalGainsAmount: number;
  capitalGainsRate: number;
  capitalGainsTax: number;
  // --- Federal ---
  federalOrdinaryIncome: number;
  federalTaxableIncome: number;
  federalTax: number;
  marginalFederalRate: number;
  effectiveFederalRate: number;
  // --- State ---
  stateTax: number;
  effectiveStateRate: number;
  // --- Totals ---
  totalTax: number;
  effectiveTotalRate: number;
  // --- Roth conversion tax impact ---
  rothConversionTaxImpact: number;
}

// ---------------------------------------------------------------------------
// Run input / output types
// ---------------------------------------------------------------------------

export interface TaxPlanningRunInput {
  householdId: string;
  scenarioId: string;
  label?: string;
  taxAssumptions: {
    capitalGainsBasisRatio?: number;
    rothConversion?: {
      annualConversionAmount: number;
      startYear: number;
      endYear: number;
    };
  };
  withdrawalOrderingType?: string;
}

export interface TaxPlanningYearResult {
  year: number;
  // Income
  grossIncome: number;
  earnedIncome: number;
  benefitsIncome: number;
  ssBenefits: number;
  withdrawals: number;
  taxDeferredWithdrawal: number;
  taxFreeWithdrawal: number;
  taxableWithdrawal: number;
  rothConversionAmount: number;
  // Tax detail
  taxBreakdown: AnnualTaxBreakdown;
  // Cash flow
  expenses: number;
  liabilityPayments: number;
  totalTax: number;
  netCash: number;
  shortfall: number;
  // Balances
  beginningAssets: number;
  endingAssets: number;
  depleted: boolean;
  // Basis tracking (for capital gains)
  taxableBasisBalance: number;
}

export interface TaxPlanningRunSummary {
  // Tax totals
  totalFederalTax: number;
  totalStateTax: number;
  totalLifetimeTax: number;
  totalCapitalGainsTax: number;
  // Averages
  averageAnnualTax: number;
  averageEffectiveRate: number;
  peakAnnualTax: number;
  peakTaxYear: number;
  // Tax at key points
  taxAtRetirementStart: number;
  // Plan durability
  success: boolean;
  firstDepletionYear: number | null;
  firstRetirementYear: number | null;
  endingAssets: number;
  endingNetWorth: number;
  totalWithdrawals: number;
  // Roth conversion summary
  rothConversionYears: number;
  totalRothConverted: number;
  totalRothConversionTax: number;
  // Config used
  filingStatus: FilingStatusType;
  stateOfResidence: string;
  projectionStartYear: number;
  projectionEndYear: number;
}

export interface TaxPlanningRunResult {
  runId: string;
  householdId: string;
  scenarioId: string | null;
  scenarioName: string;
  label: string;
  createdAt: string;
  taxAssumptions: TaxAssumptions;
  summary: TaxPlanningRunSummary;
  yearByYear: TaxPlanningYearResult[];
}

export interface TaxPlanningSummaryItem {
  runId: string;
  label: string;
  scenarioName: string;
  filingStatus: FilingStatusType;
  stateOfResidence: string;
  success: boolean;
  firstDepletionYear: number | null;
  totalLifetimeTax: number;
  totalFederalTax: number;
  totalStateTax: number;
  totalWithdrawals: number;
  endingAssets: number;
  hasRothConversion: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Comparison types
// ---------------------------------------------------------------------------

export interface TaxComparisonResult {
  runA: TaxPlanningRunResult;
  runB: TaxPlanningRunResult;
  configDiffs: Array<{ label: string; a: string; b: string }>;
  outcomeDiffs: Array<{
    label: string;
    a: string;
    b: string;
    delta: string;
    direction: 'better' | 'worse' | 'neutral';
  }>;
  yearByYearDelta: Array<{
    year: number;
    totalTaxA: number;
    totalTaxB: number;
    delta: number;
  }>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface TaxPlanningValidation {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TAX_BOUNDS = {
  MIN_BASIS_RATIO: 0,
  MAX_BASIS_RATIO: 1,
  DEFAULT_BASIS_RATIO: 0.60,
  MIN_CONVERSION_AMOUNT: 0,
  MAX_CONVERSION_AMOUNT: 5_000_000,
  BRACKET_BASE_YEAR: 2024,
  ENGINE_VERSION: '1.0.0',
} as const;

/**
 * Social Security provisional income thresholds.
 * Source: IRS Publication 915.
 * MFJ has higher thresholds because both spouses' income is combined.
 */
export const SS_TAX_THRESHOLDS: Record<FilingStatusType, { t1: number; t2: number }> = {
  SINGLE:                      { t1: 25_000, t2: 34_000 },
  HEAD_OF_HOUSEHOLD:           { t1: 25_000, t2: 34_000 },
  MARRIED_FILING_SEPARATELY:   { t1: 0,      t2: 0      }, // MFS: all SS may be taxable at 85%
  MARRIED_FILING_JOINTLY:      { t1: 32_000, t2: 44_000 },
};
