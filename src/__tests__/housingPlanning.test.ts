import { describe, test, expect } from 'vitest';

import {
  validateHousingPlanningInput,
  loadEffectiveHousingAssumptions,
  getAnnualHousingCostForYear,
} from '../server/housing/housingAssumptionService';

import {
  computeDownsizingEquityRelease,
  estimateSalePriceAtYear,
  estimateMortgageBalanceAtYear,
  buildDownsizingSummary,
} from '../server/housing/downsizingService';

import {
  computeRelocationResult,
  isNoIncomeTaxRelocationState,
} from '../server/housing/relocationService';

import {
  computeEquityReleaseBalanceSheetImpact,
  applyEquityReleaseToAssets,
  describeEquityRelease,
} from '../server/housing/equityReleaseService';

import {
  computeLegacyProjection,
  extractLegacyFromYearByYear,
  compareLegacyOutcomes,
} from '../server/housing/legacyProjectionService';

import { compareHousingPlanningRuns } from '../server/housing/housingComparisonService';

import type {
  HousingPlanningInput,
  HousingYearResult,
  EquityReleaseResult,
  HousingPlanningRunResult,
  HousingPlanningRunSummary,
} from '../server/housing/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<HousingPlanningInput> = {}): HousingPlanningInput {
  return {
    householdId: 'hh-test',
    scenarioId: 'sc-test',
    label: 'Test Housing Analysis',
    strategy: 'stay_in_place',
    currentProperty: {
      currentValue: 500000,
      mortgageBalance: 200000,
      annualAppreciationRate: 0.03,
      annualHousingCost: 24000,
      annualMortgagePayment: 18000,
    },
    downsizing: {
      enabled: false,
      eventYear: 2030,
      expectedSalePrice: 600000,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 180000,
      buyReplacementHome: true,
      replacementHomeCost: 350000,
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000,
      oneTimeMoveCost: 10000,
    },
    relocation: {
      enabled: false,
      eventYear: 2030,
      destinationState: 'FL',
      newAnnualHousingCost: 20000,
      oneTimeMoveCost: 15000,
      buyReplacementHome: false,
      replacementHomeCost: 0,
      replacementHomeMortgage: 0,
    },
    gifting: {
      enabled: false,
      annualGiftAmount: 18000,
    },
    includeLegacyProjection: true,
    generalInflationRate: 0.025,
    ...overrides,
  };
}

function makeYearResult(overrides: Partial<HousingYearResult> = {}): HousingYearResult {
  return {
    year: 2026,
    primaryAge: 65,
    strategy: 'stay_in_place',
    housingEventOccurred: false,
    equityReleased: 0,
    annualHousingCost: 24000,
    mortgagePayment: 18000,
    oneTimeCost: 0,
    giftingAmount: 0,
    estimatedPropertyValue: 500000,
    estimatedMortgageBalance: 200000,
    estimatedRealEstateEquity: 300000,
    totalExpenses: 24000,
    withdrawals: 24000,
    endingAssets: 476000,
    depleted: false,
    ...overrides,
  };
}

function makeEquityRelease(overrides: Partial<EquityReleaseResult> = {}): EquityReleaseResult {
  return {
    grossSalePrice: 600000,
    sellingCosts: 36000,
    mortgagePayoff: 180000,
    replacementHomeCost: 350000,
    oneTimeMoveCost: 10000,
    netReleasedEquity: 24000,
    ...overrides,
  };
}

function makeRunResult(
  id: string,
  label: string,
  summaryOverrides: Partial<HousingPlanningRunSummary> = {},
  configOverrides: Partial<HousingPlanningInput> = {},
): HousingPlanningRunResult {
  const summary: HousingPlanningRunSummary = {
    strategy: 'stay_in_place',
    projectionStartYear: 2026,
    projectionEndYear: 2056,
    netReleasedEquity: 0,
    totalLifetimeHousingCost: 720000,
    totalLifetimeGifting: 0,
    endingFinancialAssets: 300000,
    endingRealEstateEquity: 400000,
    projectedNetEstate: 700000,
    success: true,
    peakAnnualHousingCost: 30000,
    averageAnnualHousingCost: 24000,
    ...summaryOverrides,
  };
  return {
    runId: id,
    label,
    scenarioName: 'Test Scenario',
    createdAt: new Date().toISOString(),
    summary,
    yearByYear: [
      makeYearResult({ year: 2026, annualHousingCost: 24000 }),
      makeYearResult({ year: 2027, annualHousingCost: 24600 }),
    ],
    config: makeInput(configOverrides),
  };
}

// ---------------------------------------------------------------------------
// 1. HousingAssumptionService
// ---------------------------------------------------------------------------

describe('HousingAssumptionService — validateHousingPlanningInput', () => {
  test('valid input passes', () => {
    const result = validateHousingPlanningInput(makeInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing householdId fails', () => {
    const result = validateHousingPlanningInput(makeInput({ householdId: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('householdId'))).toBe(true);
  });

  test('missing scenarioId fails', () => {
    const result = validateHousingPlanningInput(makeInput({ scenarioId: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('scenarioId'))).toBe(true);
  });

  test('blank label fails', () => {
    const result = validateHousingPlanningInput(makeInput({ label: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('label'))).toBe(true);
  });

  test('invalid sellingCostPercent >20% fails', () => {
    const result = validateHousingPlanningInput(makeInput({
      strategy: 'downsize',
      downsizing: { ...makeInput().downsizing, enabled: true, sellingCostPercent: 0.25, expectedSalePrice: 600000 },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sellingCostPercent'))).toBe(true);
  });

  test('negative currentValue fails', () => {
    const result = validateHousingPlanningInput(makeInput({
      currentProperty: { ...makeInput().currentProperty, currentValue: -1 },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('currentValue'))).toBe(true);
  });

  test('relocation requires destinationState when enabled', () => {
    const result = validateHousingPlanningInput(makeInput({
      strategy: 'relocate',
      relocation: { ...makeInput().relocation, enabled: true, destinationState: '' },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('destinationState'))).toBe(true);
  });

  test('gifting negative annualGiftAmount fails', () => {
    const result = validateHousingPlanningInput(makeInput({
      gifting: { enabled: true, annualGiftAmount: -1000 },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('annualGiftAmount'))).toBe(true);
  });
});

describe('HousingAssumptionService — loadEffectiveHousingAssumptions', () => {
  test('strategy=stay_in_place returns same pre/post cost', () => {
    const input = makeInput({ strategy: 'stay_in_place' });
    const assumptions = loadEffectiveHousingAssumptions(input);
    expect(assumptions.preEventAnnualHousingCost).toBe(24000);
    expect(assumptions.postEventAnnualHousingCost).toBe(24000);
    expect(assumptions.housingEventYear).toBeUndefined();
  });

  test('strategy=downsize sets housingEventYear and postEventAnnualHousingCost', () => {
    const input = makeInput({
      strategy: 'downsize',
      downsizing: { ...makeInput().downsizing, enabled: true, eventYear: 2030, postMoveAnnualHousingCost: 15000 },
    });
    const assumptions = loadEffectiveHousingAssumptions(input);
    expect(assumptions.housingEventYear).toBe(2030);
    expect(assumptions.postEventAnnualHousingCost).toBe(15000);
  });
});

describe('HousingAssumptionService — getAnnualHousingCostForYear', () => {
  test('inflates correctly from base year', () => {
    const input = makeInput();
    const assumptions = loadEffectiveHousingAssumptions(input);
    const cost2026 = getAnnualHousingCostForYear(assumptions, 2026, 2026, false);
    const cost2027 = getAnnualHousingCostForYear(assumptions, 2027, 2026, false);
    expect(cost2026).toBeCloseTo(24000, 0);
    expect(cost2027).toBeCloseTo(24000 * 1.025, 1);
  });

  test('returns post-event cost after event year', () => {
    const input = makeInput({
      strategy: 'downsize',
      downsizing: { ...makeInput().downsizing, enabled: true, eventYear: 2030, postMoveAnnualHousingCost: 15000 },
    });
    const assumptions = loadEffectiveHousingAssumptions(input);
    const preCost = getAnnualHousingCostForYear(assumptions, 2029, 2026, false);
    const postCost = getAnnualHousingCostForYear(assumptions, 2030, 2026, false);
    // Post-event year should be based on postMoveAnnualHousingCost = 15000, inflated 4 years
    expect(preCost).toBeGreaterThan(15000); // pre-event: 24000 * inflation^3 years
    expect(postCost).toBeLessThan(preCost); // post-event: 15000 * inflation^4 years < 24000 * inflation^3
  });
});

// ---------------------------------------------------------------------------
// 2. DownsizingService
// ---------------------------------------------------------------------------

describe('DownsizingService — computeDownsizingEquityRelease', () => {
  test('correct net with selling costs only', () => {
    const config = {
      enabled: true,
      eventYear: 2030,
      expectedSalePrice: 600000,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 0,
      buyReplacementHome: false,
      replacementHomeCost: 0,
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000,
      oneTimeMoveCost: 0,
    };
    const result = computeDownsizingEquityRelease(config);
    expect(result.sellingCosts).toBeCloseTo(36000, 0);
    expect(result.netReleasedEquity).toBeCloseTo(564000, 0);
  });

  test('correct net with mortgage payoff', () => {
    const config = {
      enabled: true,
      eventYear: 2030,
      expectedSalePrice: 600000,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 180000,
      buyReplacementHome: false,
      replacementHomeCost: 0,
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000,
      oneTimeMoveCost: 0,
    };
    const result = computeDownsizingEquityRelease(config);
    expect(result.mortgagePayoff).toBe(180000);
    expect(result.netReleasedEquity).toBeCloseTo(600000 - 36000 - 180000, 0);
  });

  test('correct net with replacement home and move cost', () => {
    const config = {
      enabled: true,
      eventYear: 2030,
      expectedSalePrice: 600000,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 180000,
      buyReplacementHome: true,
      replacementHomeCost: 350000,
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000,
      oneTimeMoveCost: 10000,
    };
    const result = computeDownsizingEquityRelease(config);
    const expected = 600000 - 36000 - 180000 - 350000 - 10000;
    expect(result.netReleasedEquity).toBe(Math.max(0, expected));
  });

  test('net released equity never goes negative', () => {
    const config = {
      enabled: true,
      eventYear: 2030,
      expectedSalePrice: 100000,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 90000,
      buyReplacementHome: true,
      replacementHomeCost: 100000,
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000,
      oneTimeMoveCost: 10000,
    };
    const result = computeDownsizingEquityRelease(config);
    expect(result.netReleasedEquity).toBeGreaterThanOrEqual(0);
  });

  test('no replacement home: replacementHomeCost is 0', () => {
    const config = {
      enabled: true,
      eventYear: 2030,
      expectedSalePrice: 600000,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 0,
      buyReplacementHome: false,
      replacementHomeCost: 999999, // should be ignored
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000,
      oneTimeMoveCost: 0,
    };
    const result = computeDownsizingEquityRelease(config);
    expect(result.replacementHomeCost).toBe(0);
  });
});

describe('DownsizingService — estimateSalePriceAtYear', () => {
  test('appreciates correctly over 5 years at 3%', () => {
    const price = estimateSalePriceAtYear(500000, 2026, 2031, 0.03);
    expect(price).toBeCloseTo(500000 * Math.pow(1.03, 5), 0);
  });

  test('same year returns current value', () => {
    const price = estimateSalePriceAtYear(500000, 2026, 2026, 0.03);
    expect(price).toBeCloseTo(500000, 0);
  });
});

describe('DownsizingService — estimateMortgageBalanceAtYear', () => {
  test('reduces over time', () => {
    const bal5 = estimateMortgageBalanceAtYear(200000, 18000, 2026, 2031);
    expect(bal5).toBeLessThan(200000);
  });

  test('never goes negative', () => {
    const bal = estimateMortgageBalanceAtYear(50000, 18000, 2026, 2050);
    expect(bal).toBeGreaterThanOrEqual(0);
  });

  test('zero balance input returns 0', () => {
    const bal = estimateMortgageBalanceAtYear(0, 18000, 2026, 2030);
    expect(bal).toBe(0);
  });
});

describe('DownsizingService — buildDownsizingSummary', () => {
  test('housing cost reduction computed correctly', () => {
    const config = makeInput().downsizing;
    const prior = 24000;
    const summary = buildDownsizingSummary({ ...config, enabled: true, postMoveAnnualHousingCost: 15000 }, prior);
    expect(summary.housingCostReduction).toBe(prior - 15000);
    expect(summary.newAnnualHousingCost).toBe(15000);
  });

  test('replacement home values populated when buyReplacementHome=true', () => {
    const config = { ...makeInput().downsizing, enabled: true, buyReplacementHome: true, replacementHomeCost: 350000, replacementHomeMortgage: 50000 };
    const summary = buildDownsizingSummary(config, 24000);
    expect(summary.replacementPropertyValue).toBe(350000);
    expect(summary.replacementMortgageBalance).toBe(50000);
  });
});

// ---------------------------------------------------------------------------
// 3. RelocationService
// ---------------------------------------------------------------------------

describe('RelocationService — computeRelocationResult', () => {
  test('housing cost change computed correctly', () => {
    const config = makeInput().relocation;
    const result = computeRelocationResult({ ...config, enabled: true, newAnnualHousingCost: 20000 }, 24000, 500000, 200000, 0.06);
    expect(result.housingCostChange).toBe(20000 - 24000); // -4000
  });

  test('no-income-tax state note is generated for TX', () => {
    const config = { ...makeInput().relocation, enabled: true, destinationState: 'TX' };
    const result = computeRelocationResult(config, 24000, 500000, 200000, 0.06);
    expect(result.stateTaxImplication).toContain('no state income tax');
  });

  test('equity release computed when buyReplacementHome=true', () => {
    const config = {
      ...makeInput().relocation,
      enabled: true,
      buyReplacementHome: true,
      replacementHomeCost: 400000,
      replacementHomeMortgage: 0,
      oneTimeMoveCost: 15000,
    };
    const result = computeRelocationResult(config, 24000, 500000, 200000, 0.06);
    expect(result.equityRelease).toBeDefined();
    expect(result.equityRelease?.grossSalePrice).toBe(500000);
  });

  test('no equity release when buyReplacementHome=false', () => {
    const config = { ...makeInput().relocation, enabled: true, buyReplacementHome: false };
    const result = computeRelocationResult(config, 24000, 500000, 200000, 0.06);
    expect(result.equityRelease).toBeUndefined();
  });
});

describe('RelocationService — isNoIncomeTaxRelocationState', () => {
  test('TX is no income tax state', () => {
    expect(isNoIncomeTaxRelocationState('TX')).toBe(true);
  });

  test('FL is no income tax state', () => {
    expect(isNoIncomeTaxRelocationState('FL')).toBe(true);
  });

  test('CA is not a no income tax state', () => {
    expect(isNoIncomeTaxRelocationState('CA')).toBe(false);
  });

  test('case insensitive check', () => {
    expect(isNoIncomeTaxRelocationState('tx')).toBe(true);
    expect(isNoIncomeTaxRelocationState('ca')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. EquityReleaseService
// ---------------------------------------------------------------------------

describe('EquityReleaseService — computeEquityReleaseBalanceSheetImpact', () => {
  test('correct balance sheet impact with replacement home', () => {
    const er = makeEquityRelease();
    const impact = computeEquityReleaseBalanceSheetImpact(er, 500000, 350000);
    expect(impact.removedRealEstateEquity).toBe(500000 - 180000);
    expect(impact.addedRealEstateEquity).toBe(350000);
    expect(impact.addToInvestableAssets).toBe(er.netReleasedEquity);
  });

  test('no replacement home: addedRealEstateEquity is 0', () => {
    const er = makeEquityRelease({ replacementHomeCost: 0, netReleasedEquity: 384000 });
    const impact = computeEquityReleaseBalanceSheetImpact(er, 500000, 0);
    expect(impact.addedRealEstateEquity).toBe(0);
  });
});

describe('EquityReleaseService — applyEquityReleaseToAssets', () => {
  test('adds net released equity to current assets', () => {
    const er = makeEquityRelease({ netReleasedEquity: 50000 });
    const result = applyEquityReleaseToAssets(500000, er);
    expect(result).toBe(550000);
  });

  test('zero released equity: assets unchanged', () => {
    const er = makeEquityRelease({ netReleasedEquity: 0 });
    expect(applyEquityReleaseToAssets(500000, er)).toBe(500000);
  });
});

describe('EquityReleaseService — describeEquityRelease', () => {
  test('returns array of strings with key components', () => {
    const er = makeEquityRelease();
    const lines = describeEquityRelease(er);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => l.includes('Gross sale price'))).toBe(true);
    expect(lines.some((l) => l.includes('Net released equity'))).toBe(true);
  });

  test('includes replacement home line when cost > 0', () => {
    const er = makeEquityRelease({ replacementHomeCost: 350000 });
    const lines = describeEquityRelease(er);
    expect(lines.some((l) => l.includes('Replacement home'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. LegacyProjectionService
// ---------------------------------------------------------------------------

describe('LegacyProjectionService — computeLegacyProjection', () => {
  test('correct net estate', () => {
    const result = computeLegacyProjection(300000, 400000, 50000, 0, 2056);
    expect(result.projectedNetEstate).toBe(300000 + 400000 - 50000);
    expect(result.projectionYear).toBe(2056);
  });

  test('net estate is zero when all assets depleted', () => {
    const result = computeLegacyProjection(0, 0, 0, 0, 2056);
    expect(result.projectedNetEstate).toBe(0);
  });

  test('note mentions gifting when total gifting > 0', () => {
    const result = computeLegacyProjection(300000, 400000, 0, 50000, 2056);
    expect(result.note).toContain('gifting');
    expect(result.totalLifetimeGifting).toBe(50000);
  });

  test('note is planning-grade disclaimer', () => {
    const result = computeLegacyProjection(300000, 400000, 0, 0, 2056);
    expect(result.note).toContain('Planning-grade estimate');
  });
});

describe('LegacyProjectionService — extractLegacyFromYearByYear', () => {
  test('extracts from last year of projection', () => {
    const years = [
      makeYearResult({ year: 2026, endingAssets: 500000, estimatedRealEstateEquity: 300000, estimatedMortgageBalance: 150000 }),
      makeYearResult({ year: 2056, endingAssets: 200000, estimatedRealEstateEquity: 600000, estimatedMortgageBalance: 0 }),
    ];
    const legacy = extractLegacyFromYearByYear(years, 50000);
    expect(legacy?.projectionYear).toBe(2056);
    expect(legacy?.endingFinancialAssets).toBe(200000);
    expect(legacy?.totalLifetimeGifting).toBe(50000);
  });

  test('returns undefined for empty array', () => {
    expect(extractLegacyFromYearByYear([], 0)).toBeUndefined();
  });
});

describe('LegacyProjectionService — compareLegacyOutcomes', () => {
  test('correct delta direction when B has higher net estate', () => {
    const legacyA = computeLegacyProjection(200000, 300000, 0, 0, 2056);
    const legacyB = computeLegacyProjection(400000, 300000, 0, 0, 2056);
    const comp = compareLegacyOutcomes(legacyA, legacyB);
    expect(comp.direction).toBe('better');
    expect(comp.netEstateDelta).toBeGreaterThan(0);
  });

  test('neutral when delta < $1000', () => {
    const legacyA = computeLegacyProjection(300000, 400000, 0, 0, 2056);
    const legacyB = computeLegacyProjection(300500, 400000, 0, 0, 2056); // $500 more
    const comp = compareLegacyOutcomes(legacyA, legacyB);
    expect(comp.direction).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// 6. HousingComparisonService
// ---------------------------------------------------------------------------

describe('HousingComparisonService — compareHousingPlanningRuns', () => {
  test('detects strategy config diff', () => {
    const runA = makeRunResult('a', 'Run A', {}, { strategy: 'stay_in_place' });
    const runB = makeRunResult('b', 'Run B', {}, { strategy: 'downsize' });
    const result = compareHousingPlanningRuns(runA, runB);
    expect(result.configDiffs.some((d) => d.label === 'Housing Strategy')).toBe(true);
  });

  test('detects downsizing config diff', () => {
    const runA = makeRunResult('a', 'Run A', {}, {});
    const runB = makeRunResult('b', 'Run B', {}, {
      downsizing: { ...makeInput().downsizing, enabled: true },
    });
    const result = compareHousingPlanningRuns(runA, runB);
    expect(result.configDiffs.some((d) => d.label === 'Downsizing')).toBe(true);
  });

  test('computes outcome diffs correctly', () => {
    const runA = makeRunResult('a', 'Run A', { endingFinancialAssets: 200000, projectedNetEstate: 500000 });
    const runB = makeRunResult('b', 'Run B', { endingFinancialAssets: 400000, projectedNetEstate: 800000 });
    const result = compareHousingPlanningRuns(runA, runB);
    const estateDiff = result.outcomeDiffs.find((d) => d.label === 'Projected Net Estate');
    expect(estateDiff).toBeDefined();
    expect(estateDiff?.direction).toBe('better');
  });

  test('year-by-year delta is computed', () => {
    const runA = makeRunResult('a', 'Run A');
    const runB = makeRunResult('b', 'Run B', {}, {});
    const result = compareHousingPlanningRuns(runA, runB);
    expect(result.yearByYearDelta.length).toBeGreaterThan(0);
    expect(typeof result.yearByYearDelta[0].delta).toBe('number');
  });

  test('run A and B metadata is correct', () => {
    const runA = makeRunResult('id-a', 'Analysis Alpha');
    const runB = makeRunResult('id-b', 'Analysis Beta');
    const result = compareHousingPlanningRuns(runA, runB);
    expect(result.runA.runId).toBe('id-a');
    expect(result.runA.label).toBe('Analysis Alpha');
    expect(result.runB.runId).toBe('id-b');
  });

  test('worse direction when B has higher housing cost', () => {
    const runA = makeRunResult('a', 'Run A', { totalLifetimeHousingCost: 500000 });
    const runB = makeRunResult('b', 'Run B', { totalLifetimeHousingCost: 700000 });
    const result = compareHousingPlanningRuns(runA, runB);
    const costDiff = result.outcomeDiffs.find((d) => d.label === 'Total Lifetime Housing Cost');
    expect(costDiff?.direction).toBe('worse');
  });
});

// ---------------------------------------------------------------------------
// 7. Golden cases
// ---------------------------------------------------------------------------

describe('Golden cases', () => {
  test('stay-in-place: no equity release, same cost both sides', () => {
    const input = makeInput({ strategy: 'stay_in_place' });
    const assumptions = loadEffectiveHousingAssumptions(input);
    expect(assumptions.housingEventYear).toBeUndefined();
    expect(assumptions.preEventAnnualHousingCost).toBe(assumptions.postEventAnnualHousingCost);
  });

  test('downsize at 2030: equity released correctly', () => {
    const ds = {
      enabled: true,
      eventYear: 2030,
      expectedSalePrice: 600000,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 180000,
      buyReplacementHome: false,
      replacementHomeCost: 0,
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000,
      oneTimeMoveCost: 10000,
    };
    const er = computeDownsizingEquityRelease(ds);
    expect(er.netReleasedEquity).toBe(600000 - 36000 - 180000 - 0 - 10000);
  });

  test('downsize with replacement home: smaller net equity release', () => {
    const noReplacement = computeDownsizingEquityRelease({
      enabled: true, eventYear: 2030, expectedSalePrice: 600000,
      sellingCostPercent: 0.06, mortgagePayoffAmount: 180000,
      buyReplacementHome: false, replacementHomeCost: 0, replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000, oneTimeMoveCost: 10000,
    });
    const withReplacement = computeDownsizingEquityRelease({
      enabled: true, eventYear: 2030, expectedSalePrice: 600000,
      sellingCostPercent: 0.06, mortgagePayoffAmount: 180000,
      buyReplacementHome: true, replacementHomeCost: 350000, replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 15000, oneTimeMoveCost: 10000,
    });
    expect(withReplacement.netReleasedEquity).toBeLessThan(noReplacement.netReleasedEquity);
  });

  test('relocation to TX: housing cost changes, no-income-tax note generated', () => {
    const config = {
      enabled: true, eventYear: 2030, destinationState: 'TX',
      newAnnualHousingCost: 18000, oneTimeMoveCost: 15000,
      buyReplacementHome: false, replacementHomeCost: 0, replacementHomeMortgage: 0,
    };
    const result = computeRelocationResult(config, 24000, 500000, 200000, 0.06);
    expect(result.housingCostChange).toBe(18000 - 24000);
    expect(result.stateTaxImplication).toContain('no state income tax');
  });

  test('legacy with gifting: gifting recorded in projection', () => {
    const result = computeLegacyProjection(300000, 400000, 0, 90000, 2056);
    expect(result.totalLifetimeGifting).toBe(90000);
    expect(result.note).toContain('90,000');
  });

  test('invalid config rejected: missing label and negative values', () => {
    const result = validateHousingPlanningInput(makeInput({
      label: '',
      currentProperty: { ...makeInput().currentProperty, currentValue: -100, mortgageBalance: -200 },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
