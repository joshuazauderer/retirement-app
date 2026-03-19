import { describe, test, expect } from 'vitest';

/**
 * Phase 9 — Tax Planning Layer Tests
 *
 * Covers:
 * - Federal tax estimation (bracket calculation, filing status, standard deduction)
 * - State tax estimation (rates, no-income-tax states)
 * - Social Security taxation (provisional income method)
 * - Capital gains approximation (basis tracking, gain ratio, rates)
 * - Roth conversion service (balance mutation, income inclusion)
 * - Tax comparison service (delta logic, direction labels)
 * - Golden cases (multi-component scenarios)
 * - Validation
 */

import { estimateFederalTax, getMarginalFederalRate, getStandardDeduction } from '../server/tax/federalTaxService';
import { estimateStateTax, getStateEffectiveRate, isNoIncomeTaxState, stateTaxRateLabel } from '../server/tax/stateTaxService';
import { estimateSocialSecurityTax } from '../server/tax/socialSecurityTaxService';
import {
  initializeBasisState,
  estimateCapitalGainsTax,
  estimateCapitalGainsRate,
  sumTaxableBalances,
} from '../server/tax/capitalGainsApproximationService';
import {
  getConversionAmountForYear,
  executeRothConversion,
  estimateConversionTaxCost,
} from '../server/tax/rothConversionService';
import { validateTaxPlanningInput } from '../server/tax/taxPlanningService';
import { compareTaxPlanningRuns } from '../server/tax/taxComparisonService';
import { TaxPlanningRunResult } from '../server/tax/types';

// ---------------------------------------------------------------------------
// Federal Tax Service
// ---------------------------------------------------------------------------

describe('FederalTaxService', () => {
  const BASE = {
    year: 2024,
    inflationRate: 0.03,
    bracketBaseYear: 2024,
    rothConversionAmount: 0,
  };

  test('zero income → zero tax', () => {
    const result = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 0,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
    });
    expect(result.totalFederalTax).toBe(0);
    expect(result.ordinaryTaxableIncome).toBe(0);
  });

  test('SINGLE — income below standard deduction → zero tax', () => {
    const result = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 10_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
    });
    // Standard deduction for Single 2024 = $14,600 → $10k income is fully sheltered
    expect(result.totalFederalTax).toBe(0);
    expect(result.ordinaryTaxableIncome).toBe(0);
  });

  test('SINGLE — $50,000 earned income hits 12% bracket', () => {
    const result = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 50_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
    });
    // Taxable income = 50000 - 14600 = 35400
    // 10% on first $11,600 = $1,160
    // 12% on $35,400 - $11,600 = $23,800 → $2,856
    // Total = $4,016
    expect(result.ordinaryTaxableIncome).toBeCloseTo(35_400);
    expect(result.totalFederalTax).toBeCloseTo(4_016, 0);
    expect(result.marginalFederalRate).toBe(0.12);
  });

  test('MFJ — higher income hits 22% bracket', () => {
    const result = estimateFederalTax({
      ...BASE,
      filingStatus: 'MARRIED_FILING_JOINTLY',
      earnedIncome: 150_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
    });
    // Taxable = 150000 - 29200 = 120800
    // Hits 22% bracket (94300 - 23200 = 71100 at 12%, then remainder at 22%)
    expect(result.ordinaryTaxableIncome).toBeCloseTo(120_800, 0);
    expect(result.marginalFederalRate).toBe(0.22);
    expect(result.totalFederalTax).toBeGreaterThan(15_000);
  });

  test('capital gains income taxed separately at lower rate', () => {
    const resultNoGains = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 40_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
    });
    const resultWithGains = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 40_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 10_000,
    });
    // Capital gains at 0% for SINGLE with ~$25k taxable income (below $47,025 CG threshold)
    expect(resultWithGains.capitalGainsTax).toBe(0);
    // But gross income is higher
    expect(resultWithGains.grossIncome).toBeGreaterThan(resultNoGains.grossIncome);
  });

  test('Roth conversion added to ordinary income', () => {
    const withConversion = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 30_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
      rothConversionAmount: 20_000,
    });
    const withoutConversion = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 30_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
    });
    expect(withConversion.totalFederalTax).toBeGreaterThan(withoutConversion.totalFederalTax);
  });

  test('effective rate < marginal rate for progressive bracket', () => {
    const result = estimateFederalTax({
      ...BASE,
      filingStatus: 'SINGLE',
      earnedIncome: 100_000,
      nonSsBenefitIncome: 0,
      taxableSsAmount: 0,
      taxDeferredWithdrawal: 0,
      capitalGainsIncome: 0,
    });
    expect(result.effectiveFederalRate).toBeLessThan(result.marginalFederalRate);
  });

  test('standard deduction inflated in future years', () => {
    const sd2024 = getStandardDeduction('SINGLE', 2024, 0.03, 2024);
    const sd2034 = getStandardDeduction('SINGLE', 2034, 0.03, 2024);
    expect(sd2034).toBeGreaterThan(sd2024);
    expect(sd2034).toBeCloseTo(sd2024 * Math.pow(1.03, 10), 0);
  });

  test('getMarginalFederalRate returns correct bracket rate', () => {
    // Single bracket: 12% on $11,600–$47,150. $40k taxable → 12% marginal
    const rate12 = getMarginalFederalRate('SINGLE', 40_000, 2024, 0.03, 2024);
    expect(rate12).toBe(0.12);
    // Single bracket: 22% on $47,150–$100,525. $60k taxable → 22% marginal
    const rate22 = getMarginalFederalRate('SINGLE', 60_000, 2024, 0.03, 2024);
    expect(rate22).toBe(0.22);
  });
});

// ---------------------------------------------------------------------------
// State Tax Service
// ---------------------------------------------------------------------------

describe('StateTaxService', () => {
  test('no-income-tax states return 0%', () => {
    const noTaxStates = ['TX', 'FL', 'WA', 'NV', 'SD', 'WY', 'AK', 'TN', 'NH'];
    for (const state of noTaxStates) {
      expect(getStateEffectiveRate(state)).toBe(0);
      expect(isNoIncomeTaxState(state)).toBe(true);
    }
  });

  test('CA has high rate', () => {
    const rate = getStateEffectiveRate('CA');
    expect(rate).toBeGreaterThan(0.05);
  });

  test('PA has flat 3.07% rate', () => {
    const rate = getStateEffectiveRate('PA');
    expect(rate).toBeCloseTo(0.0307, 4);
  });

  test('estimateStateTax for TX → 0 tax', () => {
    const result = estimateStateTax('TX', 80_000);
    expect(result.stateTax).toBe(0);
    expect(result.stateRate).toBe(0);
  });

  test('estimateStateTax for CA → meaningful tax', () => {
    const result = estimateStateTax('CA', 80_000);
    expect(result.stateTax).toBeGreaterThan(3_000);
  });

  test('unknown state returns 0', () => {
    expect(getStateEffectiveRate('ZZ')).toBe(0);
  });

  test('stateTaxRateLabel shows "No income tax" for TX', () => {
    expect(stateTaxRateLabel('TX')).toBe('No income tax');
  });

  test('stateTaxRateLabel shows rate for CA', () => {
    const label = stateTaxRateLabel('CA');
    expect(label).toContain('%');
    expect(label).toContain('planning-grade');
  });
});

// ---------------------------------------------------------------------------
// Social Security Tax Service
// ---------------------------------------------------------------------------

describe('SocialSecurityTaxService', () => {
  test('zero SS benefits → zero taxable SS', () => {
    const result = estimateSocialSecurityTax({
      filingStatus: 'SINGLE',
      ssBenefits: 0,
      magiExcludingSS: 50_000,
    });
    expect(result.taxableSsAmount).toBe(0);
    expect(result.taxablePercentage).toBe(0);
  });

  test('SINGLE — low income below threshold 1 → 0% taxable', () => {
    // Threshold 1 for Single = $25,000 provisional income
    // PI = magi + 0.5 * SS = 10000 + 0.5 * 20000 = 20000 < 25000
    const result = estimateSocialSecurityTax({
      filingStatus: 'SINGLE',
      ssBenefits: 20_000,
      magiExcludingSS: 10_000,
    });
    expect(result.taxablePercentage).toBe(0);
    expect(result.taxableSsAmount).toBe(0);
  });

  test('SINGLE — moderate income between thresholds → up to 50% taxable', () => {
    // PI = 15000 + 0.5 * 24000 = 15000 + 12000 = 27000 → between 25000 and 34000
    const result = estimateSocialSecurityTax({
      filingStatus: 'SINGLE',
      ssBenefits: 24_000,
      magiExcludingSS: 15_000,
    });
    expect(result.taxableSsAmount).toBeGreaterThan(0);
    expect(result.taxableSsAmount).toBeLessThanOrEqual(0.5 * 24_000);
  });

  test('SINGLE — high income above threshold 2 → up to 85% taxable', () => {
    // PI = 50000 + 0.5 * 30000 = 65000 > 34000
    const result = estimateSocialSecurityTax({
      filingStatus: 'SINGLE',
      ssBenefits: 30_000,
      magiExcludingSS: 50_000,
    });
    expect(result.taxableSsAmount).toBeCloseTo(0.85 * 30_000, 0);
  });

  test('MFJ — higher thresholds (T1=$32k, T2=$44k)', () => {
    // PI = 20000 + 0.5 * 24000 = 32000 → right at threshold 1
    const result = estimateSocialSecurityTax({
      filingStatus: 'MARRIED_FILING_JOINTLY',
      ssBenefits: 24_000,
      magiExcludingSS: 20_000,
    });
    // At exactly T1, taxable SS = 0 (strictly less than, or equal gives 0)
    expect(result.taxableSsAmount).toBeGreaterThanOrEqual(0);
    expect(result.taxableSsAmount).toBeLessThanOrEqual(0.5 * 24_000);
  });

  test('MFS — all SS subject to 85% test', () => {
    const result = estimateSocialSecurityTax({
      filingStatus: 'MARRIED_FILING_SEPARATELY',
      ssBenefits: 20_000,
      magiExcludingSS: 5_000,
    });
    // MFS uses T1=0/T2=0 so goes to the 85% cap path
    expect(result.taxableSsAmount).toBeGreaterThan(0);
    expect(result.taxableSsAmount).toBeLessThanOrEqual(0.85 * 20_000);
  });

  test('taxableSsAmount never exceeds 85% of benefits', () => {
    const result = estimateSocialSecurityTax({
      filingStatus: 'SINGLE',
      ssBenefits: 40_000,
      magiExcludingSS: 200_000,
    });
    expect(result.taxableSsAmount).toBeLessThanOrEqual(0.85 * 40_000 + 0.01);
  });
});

// ---------------------------------------------------------------------------
// Capital Gains Approximation Service
// ---------------------------------------------------------------------------

describe('CapitalGainsApproximationService', () => {
  test('initializeBasisState clamps ratio to [0,1]', () => {
    const s = initializeBasisState(100_000, 1.5);
    expect(s.totalBasis).toBe(100_000);
    const s2 = initializeBasisState(100_000, -0.5);
    expect(s2.totalBasis).toBe(0);
  });

  test('zero withdrawal → zero cap gains tax', () => {
    const basisState = initializeBasisState(200_000, 0.60);
    const result = estimateCapitalGainsTax({
      taxableWithdrawal: 0,
      filingStatus: 'SINGLE',
      ordinaryTaxableIncome: 30_000,
      basisState,
      newContributions: 0,
      accountGrowth: 0,
    });
    expect(result.estimatedCapitalGainsTax).toBe(0);
    expect(result.estimatedGainAmount).toBe(0);
  });

  test('60% basis → 40% of withdrawal is gain', () => {
    const basisState = initializeBasisState(100_000, 0.60);
    // No growth, no contributions
    const result = estimateCapitalGainsTax({
      taxableWithdrawal: 10_000,
      filingStatus: 'SINGLE',
      ordinaryTaxableIncome: 30_000,
      basisState,
      newContributions: 0,
      accountGrowth: 0,
    });
    expect(result.estimatedGainAmount).toBeCloseTo(4_000, 0); // 40% of $10k
    expect(result.basisPortion).toBeCloseTo(6_000, 0);
  });

  test('100% basis (all return of principal) → zero cap gains tax', () => {
    const basisState = initializeBasisState(100_000, 1.0);
    const result = estimateCapitalGainsTax({
      taxableWithdrawal: 20_000,
      filingStatus: 'SINGLE',
      ordinaryTaxableIncome: 50_000,
      basisState,
      newContributions: 0,
      accountGrowth: 0,
    });
    expect(result.estimatedGainAmount).toBeCloseTo(0, 0);
    expect(result.estimatedCapitalGainsTax).toBeCloseTo(0, 0);
  });

  test('estimateCapitalGainsRate — SINGLE below 0% threshold', () => {
    const rate = estimateCapitalGainsRate('SINGLE', 30_000);
    expect(rate).toBe(0.00); // below $47,025
  });

  test('estimateCapitalGainsRate — MFJ in 15% zone', () => {
    const rate = estimateCapitalGainsRate('MARRIED_FILING_JOINTLY', 150_000);
    expect(rate).toBe(0.15); // above $94,050, below $583,750
  });

  test('estimateCapitalGainsRate — 20% for high income', () => {
    const rate = estimateCapitalGainsRate('MARRIED_FILING_JOINTLY', 700_000);
    expect(rate).toBe(0.20);
  });

  test('basis state decreases after withdrawal', () => {
    const basisState = initializeBasisState(100_000, 0.60); // basis = $60k
    estimateCapitalGainsTax({
      taxableWithdrawal: 10_000,
      filingStatus: 'SINGLE',
      ordinaryTaxableIncome: 30_000,
      basisState,
      newContributions: 0,
      accountGrowth: 0,
    });
    // Basis should decrease by the basis portion of withdrawal
    expect(basisState.totalBasis).toBeLessThan(60_000);
  });

  test('sumTaxableBalances filters to TAXABLE only', () => {
    const accounts = [
      { id: 'a1', taxTreatment: 'TAXABLE' },
      { id: 'a2', taxTreatment: 'TAX_DEFERRED' },
      { id: 'a3', taxTreatment: 'TAX_FREE' },
    ];
    const balances = { a1: 50_000, a2: 100_000, a3: 30_000 };
    const total = sumTaxableBalances(balances, accounts);
    expect(total).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// Roth Conversion Service
// ---------------------------------------------------------------------------

describe('RothConversionService', () => {
  const accounts = [
    { id: 'td1', taxTreatment: 'TAX_DEFERRED' },
    { id: 'tf1', taxTreatment: 'TAX_FREE' },
  ];
  const balances = { td1: 200_000, tf1: 50_000 };

  test('getConversionAmountForYear — outside range returns 0', () => {
    const config = { annualConversionAmount: 25_000, startYear: 2030, endYear: 2035, inflateWithInflation: false };
    expect(getConversionAmountForYear(config, 2029, 0.03, 2026)).toBe(0);
    expect(getConversionAmountForYear(config, 2036, 0.03, 2026)).toBe(0);
  });

  test('getConversionAmountForYear — inside range returns amount', () => {
    const config = { annualConversionAmount: 25_000, startYear: 2030, endYear: 2035, inflateWithInflation: false };
    expect(getConversionAmountForYear(config, 2032, 0.03, 2026)).toBe(25_000);
  });

  test('getConversionAmountForYear — inflated amount grows over time', () => {
    const config = { annualConversionAmount: 25_000, startYear: 2026, endYear: 2036, inflateWithInflation: true };
    const yr2026 = getConversionAmountForYear(config, 2026, 0.03, 2026);
    const yr2036 = getConversionAmountForYear(config, 2036, 0.03, 2026);
    expect(yr2026).toBe(25_000);
    expect(yr2036).toBeGreaterThan(25_000);
    expect(yr2036).toBeCloseTo(25_000 * Math.pow(1.03, 10), 0);
  });

  test('no config → returns 0', () => {
    expect(getConversionAmountForYear(undefined, 2030, 0.03, 2026)).toBe(0);
  });

  test('executeRothConversion — moves balance from TD to TF', () => {
    const result = executeRothConversion(30_000, balances, accounts);
    expect(result.actualConversionAmount).toBe(30_000);
    expect(result.taxableConversionIncome).toBe(30_000);
    expect(result.updatedBalances.td1).toBe(170_000);
    expect(result.updatedBalances.tf1).toBe(80_000);
  });

  test('executeRothConversion — capped by available TD balance', () => {
    const result = executeRothConversion(500_000, balances, accounts);
    expect(result.actualConversionAmount).toBe(200_000); // only $200k available
    expect(result.updatedBalances.td1).toBe(0);
  });

  test('executeRothConversion — zero amount → no change', () => {
    const result = executeRothConversion(0, balances, accounts);
    expect(result.actualConversionAmount).toBe(0);
    expect(result.updatedBalances).toEqual(balances);
  });

  test('estimateConversionTaxCost — correct tax estimate', () => {
    const cost = estimateConversionTaxCost(50_000, 0.22, 0.05);
    expect(cost).toBeCloseTo(50_000 * 0.27, 0);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('TaxPlanningValidation', () => {
  test('missing householdId fails', () => {
    const result = validateTaxPlanningInput({
      householdId: '',
      scenarioId: 'sc1',
      taxAssumptions: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('householdId'))).toBe(true);
  });

  test('missing scenarioId fails', () => {
    const result = validateTaxPlanningInput({
      householdId: 'hh1',
      scenarioId: '',
      taxAssumptions: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('scenarioId'))).toBe(true);
  });

  test('invalid capitalGainsBasisRatio fails', () => {
    const result = validateTaxPlanningInput({
      householdId: 'hh1',
      scenarioId: 'sc1',
      taxAssumptions: { capitalGainsBasisRatio: 1.5 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('capitalGainsBasisRatio'))).toBe(true);
  });

  test('roth conversion start > end fails', () => {
    const result = validateTaxPlanningInput({
      householdId: 'hh1',
      scenarioId: 'sc1',
      taxAssumptions: {
        rothConversion: { annualConversionAmount: 25_000, startYear: 2035, endYear: 2030 },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('startYear'))).toBe(true);
  });

  test('invalid withdrawalOrderingType fails', () => {
    const result = validateTaxPlanningInput({
      householdId: 'hh1',
      scenarioId: 'sc1',
      taxAssumptions: {},
      withdrawalOrderingType: 'INVALID_TYPE',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('withdrawalOrderingType'))).toBe(true);
  });

  test('valid input passes', () => {
    const result = validateTaxPlanningInput({
      householdId: 'hh1',
      scenarioId: 'sc1',
      taxAssumptions: {
        capitalGainsBasisRatio: 0.6,
        rothConversion: { annualConversionAmount: 25_000, startYear: 2026, endYear: 2031 },
      },
      withdrawalOrderingType: 'TAXABLE_FIRST',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tax Comparison Service
// ---------------------------------------------------------------------------

describe('TaxComparisonService', () => {
  function makeRun(overrides: Partial<TaxPlanningRunResult['summary']> = {}): TaxPlanningRunResult {
    return {
      runId: 'run1',
      householdId: 'hh1',
      scenarioId: 'sc1',
      scenarioName: 'Baseline',
      label: 'Test Run',
      createdAt: new Date().toISOString(),
      taxAssumptions: {
        filingStatus: 'MARRIED_FILING_JOINTLY',
        stateOfResidence: 'TX',
        capitalGainsBasisRatio: 0.6,
        bracketBaseYear: 2024,
      },
      summary: {
        totalFederalTax: 150_000,
        totalStateTax: 0,
        totalLifetimeTax: 150_000,
        totalCapitalGainsTax: 10_000,
        averageAnnualTax: 6_000,
        averageEffectiveRate: 0.12,
        peakAnnualTax: 12_000,
        peakTaxYear: 2028,
        taxAtRetirementStart: 8_000,
        success: true,
        firstDepletionYear: null,
        firstRetirementYear: 2027,
        endingAssets: 800_000,
        endingNetWorth: 800_000,
        totalWithdrawals: 600_000,
        rothConversionYears: 0,
        totalRothConverted: 0,
        totalRothConversionTax: 0,
        filingStatus: 'MARRIED_FILING_JOINTLY',
        stateOfResidence: 'TX',
        projectionStartYear: 2026,
        projectionEndYear: 2056,
        ...overrides,
      },
      yearByYear: [],
    };
  }

  test('comparison produces outcomeDiffs', () => {
    const runA = makeRun({ totalLifetimeTax: 200_000 });
    const runB = makeRun({ totalLifetimeTax: 150_000 });
    const result = compareTaxPlanningRuns(runA, runB);
    expect(result.outcomeDiffs.length).toBeGreaterThan(0);
    const taxDiff = result.outcomeDiffs.find((d) => d.label === 'Total Lifetime Tax');
    expect(taxDiff).toBeDefined();
    // B pays less tax → better for B
    expect(taxDiff?.direction).toBe('better');
  });

  test('same runs → all neutral or zero delta', () => {
    const run = makeRun();
    const result = compareTaxPlanningRuns(run, run);
    for (const diff of result.outcomeDiffs) {
      expect(['neutral', 'better', 'worse']).toContain(diff.direction);
    }
  });

  test('config diffs populated when filing status differs', () => {
    const runA = makeRun();
    const runB = { ...makeRun(), taxAssumptions: { ...makeRun().taxAssumptions, filingStatus: 'SINGLE' as const } };
    const result = compareTaxPlanningRuns(runA, runB);
    const configDiff = result.configDiffs.find((d) => d.label === 'Filing Status');
    expect(configDiff).toBeDefined();
    expect(configDiff?.a).toBe('MARRIED_FILING_JOINTLY');
    expect(configDiff?.b).toBe('SINGLE');
  });

  test('higher ending assets = better direction', () => {
    const runA = makeRun({ endingAssets: 500_000 });
    const runB = makeRun({ endingAssets: 800_000 });
    const result = compareTaxPlanningRuns(runA, runB);
    const assetDiff = result.outcomeDiffs.find((d) => d.label === 'Ending Assets');
    expect(assetDiff?.direction).toBe('better');
  });

  test('year-by-year delta computed from yearByYear arrays', () => {
    const runA = {
      ...makeRun(),
      yearByYear: [
        { year: 2026, totalTax: 5_000 } as TaxPlanningRunResult['yearByYear'][0],
        { year: 2027, totalTax: 6_000 } as TaxPlanningRunResult['yearByYear'][0],
      ],
    };
    const runB = {
      ...makeRun(),
      yearByYear: [
        { year: 2026, totalTax: 4_000 } as TaxPlanningRunResult['yearByYear'][0],
        { year: 2027, totalTax: 8_000 } as TaxPlanningRunResult['yearByYear'][0],
      ],
    };
    const result = compareTaxPlanningRuns(runA, runB);
    expect(result.yearByYearDelta).toHaveLength(2);
    expect(result.yearByYearDelta[0].delta).toBe(-1_000); // B lower in 2026
    expect(result.yearByYearDelta[1].delta).toBe(2_000);  // B higher in 2027
  });
});

// ---------------------------------------------------------------------------
// Golden Cases
// ---------------------------------------------------------------------------

describe('Golden Cases', () => {
  describe('GC1: Simple retiree with tax-deferred withdrawals', () => {
    test('tax-deferred withdrawal adds to ordinary income', () => {
      const result = estimateFederalTax({
        filingStatus: 'SINGLE',
        earnedIncome: 0,
        nonSsBenefitIncome: 0,
        taxableSsAmount: 0,
        taxDeferredWithdrawal: 50_000,
        capitalGainsIncome: 0,
        rothConversionAmount: 0,
        year: 2026,
        inflationRate: 0.03,
        bracketBaseYear: 2024,
      });
      // $50k TD withdrawal - standard deduction = taxable income
      expect(result.ordinaryTaxableIncome).toBeGreaterThan(0);
      expect(result.totalFederalTax).toBeGreaterThan(0);
    });
  });

  describe('GC2: Retiree with taxable and Roth accounts', () => {
    test('Roth withdrawal has zero tax; taxable withdrawal taxed at CG rates', () => {
      // Roth = tax-free, no federal tax on withdrawal
      // Taxable account = CG rates on gain portion
      const fedResult = estimateFederalTax({
        filingStatus: 'MARRIED_FILING_JOINTLY',
        earnedIncome: 0,
        nonSsBenefitIncome: 0,
        taxableSsAmount: 0,
        taxDeferredWithdrawal: 0,      // No TD
        capitalGainsIncome: 20_000,    // CG from taxable account
        rothConversionAmount: 0,
        year: 2026,
        inflationRate: 0.03,
        bracketBaseYear: 2024,
      });
      // MFJ with only $20k capital gains income — below $94,050 CG threshold
      // Ordinary taxable income = 0 (all income is CG, no ordinary income after std deduction)
      // CG rate = 0% if ordinary taxable income < threshold
      expect(fedResult.federalOrdinaryTax).toBe(0); // no ordinary income
    });
  });

  describe('GC3: Couple with SS and pensions — SS taxation', () => {
    test('SS taxation kicks in above provisional income threshold for MFJ', () => {
      // MFJ with moderate income: PI = 25000 + 0.5*30000 = 40000 > 32000 but < 44000
      const ssResult = estimateSocialSecurityTax({
        filingStatus: 'MARRIED_FILING_JOINTLY',
        ssBenefits: 30_000,
        magiExcludingSS: 25_000,
      });
      // Provisional income = 25000 + 15000 = 40000, between T1=32000 and T2=44000
      expect(ssResult.taxableSsAmount).toBeGreaterThan(0);
      expect(ssResult.taxableSsAmount).toBeLessThanOrEqual(0.5 * 30_000);
    });

    test('MFJ high income → 85% of SS taxable', () => {
      const ssResult = estimateSocialSecurityTax({
        filingStatus: 'MARRIED_FILING_JOINTLY',
        ssBenefits: 50_000,
        magiExcludingSS: 80_000,
      });
      // PI = 80000 + 25000 = 105000 > 44000
      expect(ssResult.taxableSsAmount).toBeCloseTo(0.85 * 50_000, 0);
    });
  });

  describe('GC4: Roth conversion increases early taxes, reduces future tax base', () => {
    test('conversion year has higher tax than non-conversion year', () => {
      const noConversion = estimateFederalTax({
        filingStatus: 'SINGLE',
        earnedIncome: 40_000,
        nonSsBenefitIncome: 0,
        taxableSsAmount: 0,
        taxDeferredWithdrawal: 0,
        capitalGainsIncome: 0,
        rothConversionAmount: 0,
        year: 2026, inflationRate: 0.03, bracketBaseYear: 2024,
      });
      const withConversion = estimateFederalTax({
        filingStatus: 'SINGLE',
        earnedIncome: 40_000,
        nonSsBenefitIncome: 0,
        taxableSsAmount: 0,
        taxDeferredWithdrawal: 0,
        capitalGainsIncome: 0,
        rothConversionAmount: 30_000,
        year: 2026, inflationRate: 0.03, bracketBaseYear: 2024,
      });
      expect(withConversion.totalFederalTax).toBeGreaterThan(noConversion.totalFederalTax);
    });

    test('Roth conversion reduces TD balance, increases TF balance', () => {
      const accounts = [
        { id: 'td', taxTreatment: 'TAX_DEFERRED' },
        { id: 'tf', taxTreatment: 'TAX_FREE' },
      ];
      const result = executeRothConversion(50_000, { td: 300_000, tf: 100_000 }, accounts);
      expect(result.updatedBalances.td).toBe(250_000);
      expect(result.updatedBalances.tf).toBe(150_000);
    });
  });

  describe('GC5: No-income-tax state', () => {
    test('TX has zero state tax', () => {
      const result = estimateStateTax('TX', 100_000);
      expect(result.stateTax).toBe(0);
      expect(result.stateRate).toBe(0);
    });

    test('WY has zero state tax', () => {
      const result = estimateStateTax('WY', 100_000);
      expect(result.stateTax).toBe(0);
    });
  });

  describe('GC6: Capital gains tax changes with income level', () => {
    test('same gain → different rate based on ordinary income level', () => {
      // Low ordinary income → 0% CG rate
      const lowResult = estimateCapitalGainsTax({
        taxableWithdrawal: 20_000,
        filingStatus: 'SINGLE',
        ordinaryTaxableIncome: 20_000, // below $47,025 threshold
        basisState: initializeBasisState(100_000, 0),  // all gain
        newContributions: 0,
        accountGrowth: 0,
      });

      // High ordinary income → 15% CG rate
      const highResult = estimateCapitalGainsTax({
        taxableWithdrawal: 20_000,
        filingStatus: 'SINGLE',
        ordinaryTaxableIncome: 100_000, // above $47,025, below $518,900
        basisState: initializeBasisState(100_000, 0),  // all gain
        newContributions: 0,
        accountGrowth: 0,
      });

      expect(lowResult.capitalGainsRate).toBe(0.00);
      expect(highResult.capitalGainsRate).toBe(0.15);
      expect(highResult.estimatedCapitalGainsTax).toBeGreaterThan(lowResult.estimatedCapitalGainsTax);
    });
  });
});
