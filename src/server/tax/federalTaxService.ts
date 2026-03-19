/**
 * Federal Tax Service — Phase 9
 *
 * Planning-grade federal income tax estimator.
 *
 * Uses 2024 bracket tables inflated forward by the assumed inflation rate.
 * Applies separate capital-gains rates on long-term gain income.
 *
 * v1 Limitations:
 * - Standard deduction only (no itemized deduction modeling)
 * - No AMT calculation
 * - No NIIT (Net Investment Income Tax) above high-income thresholds
 * - No credits (child credit, education credits, etc.)
 * - Brackets inflated uniformly by assumed inflation rate (IRS uses a specific CPI method)
 * - Capital gains thresholds simplified to align with taxable income (including LTCG)
 * - Not tax preparation software — planning estimates only
 */

import type {
  FilingStatusType,
  TaxBracket,
  FilingStatusBrackets,
  FederalTaxResult,
} from './types';

// ---------------------------------------------------------------------------
// 2024 Federal Bracket Tables
// ---------------------------------------------------------------------------

const BRACKETS_2024: Record<FilingStatusType, FilingStatusBrackets> = {
  SINGLE: {
    standardDeduction: 14_600,
    ordinary: [
      { min: 0,       max: 11_600,  rate: 0.10 },
      { min: 11_600,  max: 47_150,  rate: 0.12 },
      { min: 47_150,  max: 100_525, rate: 0.22 },
      { min: 100_525, max: 191_950, rate: 0.24 },
      { min: 191_950, max: 243_725, rate: 0.32 },
      { min: 243_725, max: 609_350, rate: 0.35 },
      { min: 609_350, max: Infinity, rate: 0.37 },
    ],
    capitalGains: [
      { min: 0,       max: 47_025,  rate: 0.00 },
      { min: 47_025,  max: 518_900, rate: 0.15 },
      { min: 518_900, max: Infinity, rate: 0.20 },
    ],
  },

  MARRIED_FILING_JOINTLY: {
    standardDeduction: 29_200,
    ordinary: [
      { min: 0,       max: 23_200,  rate: 0.10 },
      { min: 23_200,  max: 94_300,  rate: 0.12 },
      { min: 94_300,  max: 201_050, rate: 0.22 },
      { min: 201_050, max: 383_900, rate: 0.24 },
      { min: 383_900, max: 487_450, rate: 0.32 },
      { min: 487_450, max: 731_200, rate: 0.35 },
      { min: 731_200, max: Infinity, rate: 0.37 },
    ],
    capitalGains: [
      { min: 0,       max: 94_050,  rate: 0.00 },
      { min: 94_050,  max: 583_750, rate: 0.15 },
      { min: 583_750, max: Infinity, rate: 0.20 },
    ],
  },

  HEAD_OF_HOUSEHOLD: {
    standardDeduction: 21_900,
    ordinary: [
      { min: 0,       max: 16_550,  rate: 0.10 },
      { min: 16_550,  max: 63_100,  rate: 0.12 },
      { min: 63_100,  max: 100_500, rate: 0.22 },
      { min: 100_500, max: 191_950, rate: 0.24 },
      { min: 191_950, max: 243_700, rate: 0.32 },
      { min: 243_700, max: 609_350, rate: 0.35 },
      { min: 609_350, max: Infinity, rate: 0.37 },
    ],
    capitalGains: [
      { min: 0,       max: 63_000,  rate: 0.00 },
      { min: 63_000,  max: 551_350, rate: 0.15 },
      { min: 551_350, max: Infinity, rate: 0.20 },
    ],
  },

  MARRIED_FILING_SEPARATELY: {
    standardDeduction: 14_600,
    ordinary: [
      { min: 0,       max: 11_600,  rate: 0.10 },
      { min: 11_600,  max: 47_150,  rate: 0.12 },
      { min: 47_150,  max: 100_525, rate: 0.22 },
      { min: 100_525, max: 191_950, rate: 0.24 },
      { min: 191_950, max: 243_725, rate: 0.32 },
      { min: 243_725, max: 365_600, rate: 0.35 },
      { min: 365_600, max: Infinity, rate: 0.37 },
    ],
    capitalGains: [
      { min: 0,       max: 47_025,  rate: 0.00 },
      { min: 47_025,  max: 291_850, rate: 0.15 },
      { min: 291_850, max: Infinity, rate: 0.20 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Bracket helpers
// ---------------------------------------------------------------------------

/**
 * Inflate a bracket table from the base year to the current simulation year.
 * Uses the assumed inflation rate to approximate bracket drift.
 */
function inflateBrackets(
  brackets: FilingStatusBrackets,
  inflationRate: number,
  yearsFromBase: number
): FilingStatusBrackets {
  if (yearsFromBase <= 0) return brackets;
  const factor = Math.pow(1 + inflationRate, yearsFromBase);
  const scale = (b: TaxBracket): TaxBracket => ({
    min: b.min * factor,
    max: b.max === Infinity ? Infinity : b.max * factor,
    rate: b.rate,
  });
  return {
    standardDeduction: brackets.standardDeduction * factor,
    ordinary: brackets.ordinary.map(scale),
    capitalGains: brackets.capitalGains.map(scale),
  };
}

/**
 * Apply progressive bracket calculation to a taxable income amount.
 * Returns the total tax and the marginal rate at the top dollar.
 */
function applyBrackets(
  taxableIncome: number,
  brackets: TaxBracket[]
): { tax: number; marginalRate: number } {
  if (taxableIncome <= 0) return { tax: 0, marginalRate: 0 };

  let tax = 0;
  let marginalRate = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    if (taxableInBracket <= 0) continue;
    tax += taxableInBracket * bracket.rate;
    marginalRate = bracket.rate;
  }

  return { tax, marginalRate };
}

/**
 * Determine the capital gains rate that applies at a given ordinary income level.
 * LTCG rates stack on top of ordinary income (the gain occupies the upper portion
 * of taxable income). This simplified model uses the CG bracket that contains
 * the top of ordinary income as a proxy.
 */
function capitalGainsRate(
  ordinaryIncome: number,
  capitalGainsIncome: number,
  cgBrackets: TaxBracket[]
): number {
  if (capitalGainsIncome <= 0) return 0;
  // The gain sits "on top of" ordinary income in terms of bracket stacking
  const topOfGain = ordinaryIncome + capitalGainsIncome;
  let rate = 0;
  for (const bracket of cgBrackets) {
    if (topOfGain > bracket.min) {
      rate = bracket.rate;
    }
  }
  return rate;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FederalTaxInput {
  filingStatus: FilingStatusType;
  /** Gross earned income (wages, self-employment, etc.). */
  earnedIncome: number;
  /** Non-SS benefit income (pensions, annuities, etc.) — ordinary income. */
  nonSsBenefitIncome: number;
  /** Taxable portion of Social Security benefits (from socialSecurityTaxService). */
  taxableSsAmount: number;
  /** Gross withdrawal from tax-deferred accounts (all ordinary income). */
  taxDeferredWithdrawal: number;
  /** Long-term capital gains from taxable accounts (from capitalGainsApproximationService). */
  capitalGainsIncome: number;
  /** Roth conversion amount (ordinary income). */
  rothConversionAmount: number;
  /** Calendar year (used to compute bracket inflation from 2024 base). */
  year: number;
  /** Assumed inflation rate (decimal) for inflating brackets forward. */
  inflationRate: number;
  /** Base year for brackets (normally 2024). */
  bracketBaseYear: number;
}

/**
 * Estimate annual federal income tax.
 *
 * Computation flow:
 * 1. Sum all ordinary income components
 * 2. Inflate 2024 brackets to the current year
 * 3. Apply standard deduction
 * 4. Compute ordinary income tax via progressive brackets
 * 5. Compute capital gains tax separately at preferential rates
 * 6. Return detailed breakdown
 */
export function estimateFederalTax(input: FederalTaxInput): FederalTaxResult {
  const {
    filingStatus,
    earnedIncome,
    nonSsBenefitIncome,
    taxableSsAmount,
    taxDeferredWithdrawal,
    capitalGainsIncome,
    rothConversionAmount,
    year,
    inflationRate,
    bracketBaseYear,
  } = input;

  const baseBrackets = BRACKETS_2024[filingStatus];
  const yearsFromBase = Math.max(0, year - bracketBaseYear);
  const brackets = inflateBrackets(baseBrackets, inflationRate, yearsFromBase);

  // Gross income = all income before deductions (not including tax-free)
  const grossIncome =
    earnedIncome +
    nonSsBenefitIncome +
    taxableSsAmount +
    taxDeferredWithdrawal +
    capitalGainsIncome +
    rothConversionAmount;

  // Ordinary income (excludes capital gains — those have preferential rates)
  const ordinaryGrossIncome =
    earnedIncome +
    nonSsBenefitIncome +
    taxableSsAmount +
    taxDeferredWithdrawal +
    rothConversionAmount;

  // Apply standard deduction to ordinary income
  const ordinaryTaxableIncome = Math.max(0, ordinaryGrossIncome - brackets.standardDeduction);

  // Apply progressive brackets
  const { tax: federalOrdinaryTax, marginalRate } = applyBrackets(
    ordinaryTaxableIncome,
    brackets.ordinary
  );

  // Capital gains tax (preferential rates, stacks on ordinary income)
  const cgRate = capitalGainsRate(ordinaryTaxableIncome, capitalGainsIncome, brackets.capitalGains);
  const cgTax = Math.max(0, capitalGainsIncome) * cgRate;

  const totalFederalTax = federalOrdinaryTax + cgTax;
  const effectiveFederalRate = grossIncome > 0 ? totalFederalTax / grossIncome : 0;

  return {
    grossIncome,
    ordinaryTaxableIncome,
    capitalGainsIncome: Math.max(0, capitalGainsIncome),
    ssTaxableAmount: taxableSsAmount,
    rothConversionAmount,
    standardDeduction: brackets.standardDeduction,
    federalOrdinaryTax,
    capitalGainsTax: cgTax,
    totalFederalTax,
    effectiveFederalRate,
    marginalFederalRate: marginalRate,
  };
}

/**
 * Return the marginal federal rate at a given ordinary taxable income level.
 * Useful for gross-up calculations.
 */
export function getMarginalFederalRate(
  filingStatus: FilingStatusType,
  ordinaryTaxableIncome: number,
  year: number,
  inflationRate: number,
  bracketBaseYear: number
): number {
  const baseBrackets = BRACKETS_2024[filingStatus];
  const yearsFromBase = Math.max(0, year - bracketBaseYear);
  const brackets = inflateBrackets(baseBrackets, inflationRate, yearsFromBase);
  const { marginalRate } = applyBrackets(ordinaryTaxableIncome, brackets.ordinary);
  return marginalRate;
}

/**
 * Return the standard deduction for the given filing status and year.
 */
export function getStandardDeduction(
  filingStatus: FilingStatusType,
  year: number,
  inflationRate: number,
  bracketBaseYear: number
): number {
  const baseBrackets = BRACKETS_2024[filingStatus];
  const yearsFromBase = Math.max(0, year - bracketBaseYear);
  return baseBrackets.standardDeduction * Math.pow(1 + inflationRate, yearsFromBase);
}
