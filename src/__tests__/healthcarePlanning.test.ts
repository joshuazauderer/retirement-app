import { describe, test, expect } from 'vitest';

import {
  estimatePreMedicareCost,
  getPreMedicareCostForYear,
} from '../server/healthcare/preMedicareService';

import { estimateMedicareCost } from '../server/healthcare/medicareService';

import {
  getLtcCostForYear,
  isLtcActive,
} from '../server/healthcare/ltcStressService';

import {
  applyLongevityStress,
  primaryAgeInYear,
  spouseAgeInYear,
  getPrimaryAge,
  getSpouseAge,
} from '../server/healthcare/longevityStressService';

import { computeHealthcareCostForYear } from '../server/healthcare/healthcareCashFlowService';

import { validateHealthcarePlanningInput } from '../server/healthcare/healthcarePlanningService';

import { compareHealthcarePlanningRuns } from '../server/healthcare/healthcareComparisonService';

import {
  inflateHealthcareCost,
  estimateLifetimeHealthcareCost,
  healthcareInflationPremium,
  describeHealthcareInflation,
} from '../server/healthcare/healthcareInflationService';

import {
  loadEffectiveHealthcareAssumptions,
  getHealthcareCostMode,
  validateHealthcareAssumptions,
} from '../server/healthcare/healthcareAssumptionService';

import {
  computeHouseholdPreMedicareCost,
  preMedicareBridgeYearsRemaining,
} from '../server/healthcare/preMedicareCostService';

import {
  computeHouseholdMedicareCost,
  describeMedicareCoverageConfig,
  isIRMAASurchargeApplicable,
} from '../server/healthcare/medicareCostService';

import {
  computeLtcStressResult,
  summarizeLtcStress,
  LTC_NATIONAL_AVERAGES_2024,
} from '../server/healthcare/longTermCareStressService';

import { MEDICARE_2024 } from '../server/healthcare/types';

import type { SimulationSnapshot } from '../server/simulation/types';
import type {
  PreMedicareHealthcareCosts,
  MedicareHealthcareCosts,
  LongTermCareStressConfig,
  LongevityStressConfig,
  HealthcarePlanningInput,
  HealthcarePlanningRunResult,
} from '../server/healthcare/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(primaryAge: number, spouseAge?: number): SimulationSnapshot {
  const currentYear = 2026;
  const members = [
    {
      memberId: 'primary-1',
      firstName: 'Alice',
      lastName: 'Test',
      dateOfBirth: `${currentYear - primaryAge}-01-01T00:00:00.000Z`,
      currentAge: primaryAge,
      retirementTargetAge: 65,
      lifeExpectancy: 90,
      isPrimary: true,
    },
  ];
  if (spouseAge != null) {
    members.push({
      memberId: 'spouse-1',
      firstName: 'Bob',
      lastName: 'Test',
      dateOfBirth: `${currentYear - spouseAge}-01-01T00:00:00.000Z`,
      currentAge: spouseAge,
      retirementTargetAge: 65,
      lifeExpectancy: 90,
      isPrimary: false,
    });
  }
  return {
    metadata: {
      engineVersion: '1.0.0',
      snapshotGeneratedAt: new Date().toISOString(),
      householdId: 'hh-test',
      scenarioLabel: 'Test',
    },
    timeline: {
      simulationYearStart: currentYear,
      projectionEndYear: currentYear + (90 - primaryAge),
    },
    household: {
      householdId: 'hh-test',
      planningMode: 'INDIVIDUAL',
      filingStatus: 'SINGLE',
      stateOfResidence: 'CA',
    },
    members,
    incomeSources: [],
    assetAccounts: [
      {
        id: 'acct-1',
        memberId: null,
        ownerType: 'HOUSEHOLD',
        taxTreatment: 'TAX_DEFERRED',
        accountName: 'Test 401k',
        currentBalance: 500000,
        annualContribution: 0,
        expectedReturnRate: 0.07,
        isRetirementAccount: true,
      },
    ],
    liabilities: [],
    expenseProfile: {
      currentAnnualSpending: 60000,
      retirementEssential: 40000,
      retirementDiscretionary: 10000,
      healthcareAnnual: 6000,
      housingAnnual: 15000,
      inflationRate: 0.025,
    },
    benefitSources: [],
    planningAssumptions: {
      inflationRate: 0.025,
      expectedPortfolioReturn: 0.07,
      assumedEffectiveTaxRate: 0.20,
      longevityTargets: {},
      retirementAgeOverrides: {},
    },
  };
}

const preMedicareConfig: PreMedicareHealthcareCosts = {
  annualPremium: 12000,
  annualOutOfPocket: 3000,
};

const medicareConfig: MedicareHealthcareCosts = {
  includePartB: true,
  includePartD: true,
  includeMedigapOrAdvantage: true,
  additionalAnnualOOP: 0,
};

const ltcConfig: LongTermCareStressConfig = {
  enabled: true,
  startAge: 80,
  durationYears: 3,
  annualCost: 90000,
};

const longevityConfig: LongevityStressConfig = {
  enabled: true,
  targetAge: 95,
  person: 'primary',
};

function makePlanningInput(overrides: Partial<HealthcarePlanningInput> = {}): HealthcarePlanningInput {
  return {
    householdId: 'hh-test',
    scenarioId: 'sc-test',
    label: 'Test Analysis',
    preMedicare: preMedicareConfig,
    medicareEligibilityAge: 65,
    medicare: medicareConfig,
    healthcareInflationRate: 0.05,
    ltcStress: { enabled: false, startAge: 80, durationYears: 3, annualCost: 90000 },
    longevityStress: { enabled: false, targetAge: 95, person: 'primary' },
    includeSpouseHealthcare: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. PreMedicareService
// ---------------------------------------------------------------------------

describe('PreMedicareService', () => {
  test('returns premium + OOP in base year (no inflation)', () => {
    const cost = estimatePreMedicareCost(preMedicareConfig, 2026, 2026, 0.05);
    expect(cost).toBeCloseTo(15000, 0); // 12000 + 3000
  });

  test('inflates cost in future years', () => {
    const cost1 = estimatePreMedicareCost(preMedicareConfig, 2026, 2026, 0.05);
    const cost2 = estimatePreMedicareCost(preMedicareConfig, 2027, 2026, 0.05);
    expect(cost2).toBeGreaterThan(cost1);
    expect(cost2).toBeCloseTo(15000 * 1.05, 1);
  });

  test('returns 0 if age >= medicareEligibilityAge', () => {
    const cost = getPreMedicareCostForYear(preMedicareConfig, 65, 65, 2026, 2026, 0.05);
    expect(cost).toBe(0);
  });

  test('returns 0 if age > medicareEligibilityAge', () => {
    const cost = getPreMedicareCostForYear(preMedicareConfig, 70, 65, 2026, 2026, 0.05);
    expect(cost).toBe(0);
  });

  test('returns cost if age < medicareEligibilityAge', () => {
    const cost = getPreMedicareCostForYear(preMedicareConfig, 60, 65, 2026, 2026, 0.05);
    expect(cost).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. MedicareService
// ---------------------------------------------------------------------------

describe('MedicareService', () => {
  test('returns 0 if person is not Medicare eligible', () => {
    const cost = estimateMedicareCost({
      config: medicareConfig,
      personAge: 64,
      medicareEligibilityAge: 65,
      grossIncomeForIRMAA: 50000,
      filingStatus: 'SINGLE',
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(cost).toBe(0);
  });

  test('returns positive cost when Part B is included at eligibility age', () => {
    const cost = estimateMedicareCost({
      config: medicareConfig,
      personAge: 65,
      medicareEligibilityAge: 65,
      grossIncomeForIRMAA: 50000,
      filingStatus: 'SINGLE',
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(cost).toBeGreaterThan(0);
    // Base year: Part B = 174.70/mo * 12 = 2096.40; Part D = 35*12 = 420; Medigap = 150*12 = 1800; OOP = 1200
    // Total ≈ 5516
    expect(cost).toBeGreaterThan(4000);
  });

  test('applies IRMAA surcharge when income exceeds threshold', () => {
    const lowIncomeCost = estimateMedicareCost({
      config: medicareConfig,
      personAge: 65,
      medicareEligibilityAge: 65,
      grossIncomeForIRMAA: 50000,
      filingStatus: 'SINGLE',
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    const highIncomeCost = estimateMedicareCost({
      config: medicareConfig,
      personAge: 65,
      medicareEligibilityAge: 65,
      grossIncomeForIRMAA: 200000,
      filingStatus: 'SINGLE',
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(highIncomeCost).toBeGreaterThan(lowIncomeCost);
  });

  test('returns only OOP if no parts included', () => {
    const minConfig: MedicareHealthcareCosts = {
      includePartB: false,
      includePartD: false,
      includeMedigapOrAdvantage: false,
      additionalAnnualOOP: 500,
    };
    const cost = estimateMedicareCost({
      config: minConfig,
      personAge: 65,
      medicareEligibilityAge: 65,
      grossIncomeForIRMAA: 50000,
      filingStatus: 'SINGLE',
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(cost).toBeCloseTo(500, 1);
  });
});

// ---------------------------------------------------------------------------
// 3. LtcStressService
// ---------------------------------------------------------------------------

describe('LtcStressService', () => {
  test('returns 0 when disabled', () => {
    const result = getLtcCostForYear(
      { ...ltcConfig, enabled: false },
      80, 2026, 2026, 0.05,
    );
    expect(result.ltcCost).toBe(0);
    expect(result.ltcActive).toBe(false);
  });

  test('returns cost when in LTC age range', () => {
    const result = getLtcCostForYear(ltcConfig, 80, 2026, 2026, 0.05);
    expect(result.ltcCost).toBeCloseTo(90000, 0);
    expect(result.ltcActive).toBe(true);
  });

  test('returns cost at last year of LTC range', () => {
    // startAge=80, durationYears=3, so active at 80,81,82 but NOT at 83
    const result82 = getLtcCostForYear(ltcConfig, 82, 2026, 2026, 0.05);
    expect(result82.ltcActive).toBe(true);
  });

  test('returns 0 after LTC duration ends', () => {
    // age 83 = startAge 80 + durationYears 3 → NOT active
    const result = getLtcCostForYear(ltcConfig, 83, 2026, 2026, 0.05);
    expect(result.ltcCost).toBe(0);
    expect(result.ltcActive).toBe(false);
  });

  test('returns 0 before LTC start age', () => {
    const result = getLtcCostForYear(ltcConfig, 75, 2026, 2026, 0.05);
    expect(result.ltcCost).toBe(0);
    expect(result.ltcActive).toBe(false);
  });

  test('inflates LTC cost in future years', () => {
    const r1 = getLtcCostForYear(ltcConfig, 80, 2026, 2026, 0.05);
    const r2 = getLtcCostForYear(ltcConfig, 80, 2027, 2026, 0.05);
    expect(r2.ltcCost).toBeCloseTo(90000 * 1.05, 0);
    expect(r2.ltcCost).toBeGreaterThan(r1.ltcCost);
  });

  test('isLtcActive returns correct boolean', () => {
    expect(isLtcActive(ltcConfig, 80)).toBe(true);
    expect(isLtcActive(ltcConfig, 83)).toBe(false);
    expect(isLtcActive({ ...ltcConfig, enabled: false }, 80)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. LongevityStressService
// ---------------------------------------------------------------------------

describe('LongevityStressService', () => {
  test('returns same snapshot when disabled', () => {
    const snapshot = makeSnapshot(55);
    const { snapshot: out, extensionYears } = applyLongevityStress(snapshot, {
      enabled: false,
      targetAge: 95,
      person: 'primary',
    });
    expect(extensionYears).toBe(0);
    expect(out.timeline.projectionEndYear).toBe(snapshot.timeline.projectionEndYear);
  });

  test('extends timeline to target age for primary', () => {
    // Primary is 55, projecting to age 90 (35 years from 2026 = end 2061)
    const snapshot = makeSnapshot(55);
    const baseEnd = snapshot.timeline.projectionEndYear; // 2061
    const { snapshot: out, extensionYears } = applyLongevityStress(snapshot, {
      enabled: true,
      targetAge: 95,
      person: 'primary',
    });
    // Primary at end year: 55 + (2061 - 2026) = 90
    // Need 5 more years to reach 95
    expect(extensionYears).toBe(5);
    expect(out.timeline.projectionEndYear).toBe(baseEnd + 5);
  });

  test('no extension if already at or beyond target age', () => {
    // Primary is 55, projecting to 100 (already 100 > 95)
    const snapshot = makeSnapshot(55);
    // Override end year to be beyond target
    const extendedSnapshot = {
      ...snapshot,
      timeline: { ...snapshot.timeline, projectionEndYear: 2026 + 50 }, // age 105 at end
    };
    const { extensionYears } = applyLongevityStress(extendedSnapshot, {
      enabled: true,
      targetAge: 95,
      person: 'primary',
    });
    expect(extensionYears).toBe(0);
  });

  test('extends for both persons to max needed', () => {
    // Primary 55 (end year 2061 = age 90), Spouse 60 (age 95 at end year 2061)
    // For primary: need 5 more years to reach 95
    // For spouse: already at 95 at end year — no extension needed
    // → extension should be 5
    const snapshot = makeSnapshot(55, 60);
    const { extensionYears } = applyLongevityStress(snapshot, {
      enabled: true,
      targetAge: 95,
      person: 'both',
    });
    expect(extensionYears).toBe(5);
  });

  test('primaryAgeInYear computes correctly', () => {
    const snapshot = makeSnapshot(55);
    expect(primaryAgeInYear(snapshot, 2026)).toBe(55);
    expect(primaryAgeInYear(snapshot, 2036)).toBe(65);
  });

  test('spouseAgeInYear returns undefined if no spouse', () => {
    const snapshot = makeSnapshot(55);
    expect(spouseAgeInYear(snapshot, 2026)).toBeUndefined();
  });

  test('spouseAgeInYear computes correctly when spouse present', () => {
    const snapshot = makeSnapshot(55, 52);
    expect(spouseAgeInYear(snapshot, 2026)).toBe(52);
    expect(spouseAgeInYear(snapshot, 2030)).toBe(56);
  });

  test('getPrimaryAge returns primary member age', () => {
    const snapshot = makeSnapshot(62);
    expect(getPrimaryAge(snapshot)).toBe(62);
  });

  test('getSpouseAge returns undefined with no spouse', () => {
    const snapshot = makeSnapshot(60);
    expect(getSpouseAge(snapshot)).toBeUndefined();
  });

  test('getSpouseAge returns spouse age when present', () => {
    const snapshot = makeSnapshot(60, 58);
    expect(getSpouseAge(snapshot)).toBe(58);
  });
});

// ---------------------------------------------------------------------------
// 5. HealthcareCashFlowService
// ---------------------------------------------------------------------------

describe('HealthcareCashFlowService', () => {
  test('total cost equals sum of components', () => {
    const snapshot = makeSnapshot(60);
    const config = makePlanningInput();
    const result = computeHealthcareCostForYear({
      year: 2026,
      primaryAge: 60,
      spouseAge: undefined,
      grossIncome: 80000,
      snapshot,
      config,
      baseYear: 2026,
      accountBalances: {},
    });
    const sumComponents =
      result.primaryPreMedicareCost +
      result.primaryMedicareCost +
      result.spousePreMedicareCost +
      result.spouseMedicareCost +
      result.ltcCost;
    expect(result.totalHealthcareCost).toBeCloseTo(sumComponents, 5);
  });

  test('no spouse costs when includeSpouseHealthcare is false', () => {
    const snapshot = makeSnapshot(60, 58);
    const config = makePlanningInput({ includeSpouseHealthcare: false });
    const result = computeHealthcareCostForYear({
      year: 2026,
      primaryAge: 60,
      spouseAge: 58,
      grossIncome: 80000,
      snapshot,
      config,
      baseYear: 2026,
      accountBalances: {},
    });
    expect(result.spousePreMedicareCost).toBe(0);
    expect(result.spouseMedicareCost).toBe(0);
    expect(result.spouseOnMedicare).toBe(false);
  });

  test('primaryOnMedicare is true at age 65', () => {
    const snapshot = makeSnapshot(65);
    const config = makePlanningInput();
    const result = computeHealthcareCostForYear({
      year: 2026,
      primaryAge: 65,
      spouseAge: undefined,
      grossIncome: 80000,
      snapshot,
      config,
      baseYear: 2026,
      accountBalances: {},
    });
    expect(result.primaryOnMedicare).toBe(true);
    expect(result.primaryPreMedicareCost).toBe(0);
    expect(result.primaryMedicareCost).toBeGreaterThan(0);
  });

  test('LTC cost is zero when not enabled', () => {
    const snapshot = makeSnapshot(80);
    const config = makePlanningInput({ ltcStress: { enabled: false, startAge: 80, durationYears: 3, annualCost: 90000 } });
    const result = computeHealthcareCostForYear({
      year: 2026,
      primaryAge: 80,
      spouseAge: undefined,
      grossIncome: 80000,
      snapshot,
      config,
      baseYear: 2026,
      accountBalances: {},
    });
    expect(result.ltcCost).toBe(0);
    expect(result.ltcActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Validation
// ---------------------------------------------------------------------------

describe('validateHealthcarePlanningInput', () => {
  test('valid input passes', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing householdId fails', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({ householdId: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('householdId'))).toBe(true);
  });

  test('missing scenarioId fails', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({ scenarioId: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('scenarioId'))).toBe(true);
  });

  test('blank label fails', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({ label: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('label'))).toBe(true);
  });

  test('inflationRate > 20% fails', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({ healthcareInflationRate: 0.25 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('healthcareInflationRate'))).toBe(true);
  });

  test('medicareEligibilityAge out of range fails', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({ medicareEligibilityAge: 55 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('medicareEligibilityAge'))).toBe(true);
  });

  test('LTC startAge < 60 fails when enabled', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({
      ltcStress: { enabled: true, startAge: 55, durationYears: 3, annualCost: 90000 },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('LTC startAge'))).toBe(true);
  });

  test('longevity targetAge out of range fails when enabled', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({
      longevityStress: { enabled: true, targetAge: 115, person: 'primary' },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('longevityStress targetAge'))).toBe(true);
  });

  test('LTC disabled — startAge validation skipped', () => {
    const result = validateHealthcarePlanningInput(makePlanningInput({
      ltcStress: { enabled: false, startAge: 55, durationYears: 3, annualCost: 90000 },
    }));
    // disabled LTC should not trigger startAge error
    expect(result.errors.some((e) => e.includes('LTC startAge'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. HealthcareComparisonService
// ---------------------------------------------------------------------------

describe('compareHealthcarePlanningRuns', () => {
  function makeRun(
    id: string,
    label: string,
    overrideConfig: Partial<HealthcarePlanningInput>,
    summaryOverrides: Record<string, unknown> = {},
  ): HealthcarePlanningRunResult {
    return {
      runId: id,
      label,
      scenarioName: 'Test Scenario',
      createdAt: new Date().toISOString(),
      summary: {
        projectionStartYear: 2026,
        projectionEndYear: 2061,
        totalHealthcareCost: 400000,
        totalPreMedicareCost: 100000,
        totalMedicareCost: 300000,
        totalLtcCost: 0,
        peakAnnualHealthcareCost: 20000,
        peakHealthcareCostYear: 2061,
        endingAssets: 100000,
        success: true,
        averageAnnualHealthcareCost: 11428,
        longevityExtensionYears: 0,
        ...summaryOverrides,
      },
      yearByYear: [
        {
          year: 2026,
          age: 55,
          primaryPreMedicareCost: 15000,
          primaryMedicareCost: 0,
          spousePreMedicareCost: 0,
          spouseMedicareCost: 0,
          ltcCost: 0,
          totalHealthcareCost: 15000,
          primaryOnMedicare: false,
          spouseOnMedicare: false,
          ltcActive: false,
          endingAssets: 485000,
          depleted: false,
        },
      ],
      config: makePlanningInput(overrideConfig),
    };
  }

  test('detects config diffs for different inflation rates', () => {
    const runA = makeRun('a', 'Run A', { healthcareInflationRate: 0.05 });
    const runB = makeRun('b', 'Run B', { healthcareInflationRate: 0.07 });
    const result = compareHealthcarePlanningRuns(runA, runB);
    expect(result.configDiffs.some((d) => d.label === 'Healthcare Inflation Rate')).toBe(true);
  });

  test('detects LTC stress config diff', () => {
    const runA = makeRun('a', 'Run A', {});
    const runB = makeRun('b', 'Run B', {
      ltcStress: { enabled: true, startAge: 80, durationYears: 3, annualCost: 90000 },
    });
    const result = compareHealthcarePlanningRuns(runA, runB);
    expect(result.configDiffs.some((d) => d.label === 'LTC Stress')).toBe(true);
  });

  test('computes outcome diffs', () => {
    const runA = makeRun('a', 'Run A', {}, { totalHealthcareCost: 400000, endingAssets: 100000 });
    const runB = makeRun('b', 'Run B', {}, { totalHealthcareCost: 600000, endingAssets: 50000 });
    const result = compareHealthcarePlanningRuns(runA, runB);
    const totalCostDiff = result.outcomeDiffs.find((d) => d.label === 'Total Healthcare Cost');
    expect(totalCostDiff).toBeDefined();
    expect(totalCostDiff?.direction).toBe('worse'); // B has higher cost = worse
    const endingAssetsDiff = result.outcomeDiffs.find((d) => d.label === 'Ending Assets');
    expect(endingAssetsDiff?.direction).toBe('worse'); // B has lower assets = worse
  });

  test('year-by-year delta is computed', () => {
    const runA = makeRun('a', 'Run A', {});
    const runB = makeRun('b', 'Run B', {});
    const result = compareHealthcarePlanningRuns(runA, runB);
    expect(result.yearByYearDelta.length).toBeGreaterThan(0);
    expect(result.yearByYearDelta[0].delta).toBeDefined();
  });

  test('neutral direction when no meaningful delta', () => {
    const runA = makeRun('a', 'Run A', {}, { totalHealthcareCost: 400000, endingAssets: 100000 });
    const runB = makeRun('b', 'Run B', {}, { totalHealthcareCost: 400049, endingAssets: 100000 }); // < $50 delta
    const result = compareHealthcarePlanningRuns(runA, runB);
    const totalCostDiff = result.outcomeDiffs.find((d) => d.label === 'Total Healthcare Cost');
    expect(totalCostDiff?.direction).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// 8. Golden cases
// ---------------------------------------------------------------------------

describe('Golden cases', () => {
  test('early retiree at 55: pre-Medicare cost for years 55-64 only', () => {
    const snapshot = makeSnapshot(55);
    const config = makePlanningInput({ medicareEligibilityAge: 65 });

    // Year when age = 64 (still pre-Medicare)
    const preResult = computeHealthcareCostForYear({
      year: 2026 + 9,  // age 64
      primaryAge: 64,
      spouseAge: undefined,
      grossIncome: 0,
      snapshot,
      config,
      baseYear: 2026,
      accountBalances: {},
    });
    expect(preResult.primaryPreMedicareCost).toBeGreaterThan(0);
    expect(preResult.primaryMedicareCost).toBe(0);
    expect(preResult.primaryOnMedicare).toBe(false);

    // Year when age = 65 (Medicare)
    const medResult = computeHealthcareCostForYear({
      year: 2026 + 10, // age 65
      primaryAge: 65,
      spouseAge: undefined,
      grossIncome: 0,
      snapshot,
      config,
      baseYear: 2026,
      accountBalances: {},
    });
    expect(medResult.primaryPreMedicareCost).toBe(0);
    expect(medResult.primaryMedicareCost).toBeGreaterThan(0);
    expect(medResult.primaryOnMedicare).toBe(true);
  });

  test('Medicare-only person: only Medicare costs from eligibility year', () => {
    const snapshot = makeSnapshot(65);
    const config = makePlanningInput({ medicareEligibilityAge: 65 });

    const result = computeHealthcareCostForYear({
      year: 2026,
      primaryAge: 65,
      spouseAge: undefined,
      grossIncome: 50000,
      snapshot,
      config,
      baseYear: 2026,
      accountBalances: {},
    });

    expect(result.primaryPreMedicareCost).toBe(0);
    expect(result.primaryMedicareCost).toBeGreaterThan(0);
    // Expected: Part B 174.70*12 + Part D 35*12 + Medigap 150*12 + OOP 1200
    const expectedBase = (MEDICARE_2024.partB_premium_monthly + MEDICARE_2024.partD_premium_monthly + MEDICARE_2024.medigap_monthly) * 12 + MEDICARE_2024.oop_dental_vision_annual;
    expect(result.primaryMedicareCost).toBeCloseTo(expectedBase, -2); // within $100
  });

  test('LTC stress: spike appears only in specified age range (80-82)', () => {
    const snapshot = makeSnapshot(55);
    const config = makePlanningInput({
      ltcStress: { enabled: true, startAge: 80, durationYears: 3, annualCost: 90000 },
    });

    // Age 79 — before LTC
    const before = computeHealthcareCostForYear({
      year: 2026 + 24, primaryAge: 79, spouseAge: undefined,
      grossIncome: 0, snapshot, config, baseYear: 2026, accountBalances: {},
    });
    expect(before.ltcCost).toBe(0);

    // Age 80 — LTC starts
    const at80 = computeHealthcareCostForYear({
      year: 2026 + 25, primaryAge: 80, spouseAge: undefined,
      grossIncome: 0, snapshot, config, baseYear: 2026, accountBalances: {},
    });
    expect(at80.ltcCost).toBeGreaterThan(0);
    expect(at80.ltcActive).toBe(true);

    // Age 83 — after LTC
    const after = computeHealthcareCostForYear({
      year: 2026 + 28, primaryAge: 83, spouseAge: undefined,
      grossIncome: 0, snapshot, config, baseYear: 2026, accountBalances: {},
    });
    expect(after.ltcCost).toBe(0);
    expect(after.ltcActive).toBe(false);
  });

  test('longevity extension: timeline extended correctly', () => {
    // Primary age 55, snapshot projects to age 90 (end year 2061)
    const snapshot = makeSnapshot(55);
    expect(snapshot.timeline.projectionEndYear).toBe(2026 + 35); // 2061

    const { snapshot: extended, extensionYears } = applyLongevityStress(snapshot, {
      enabled: true,
      targetAge: 95,
      person: 'primary',
    });

    expect(extensionYears).toBe(5);
    expect(extended.timeline.projectionEndYear).toBe(2061 + 5); // 2066
  });
});

// ---------------------------------------------------------------------------
// 9. HealthcareInflationService
// ---------------------------------------------------------------------------

describe('HealthcareInflationService', () => {
  test('inflateHealthcareCost returns base amount in base year', () => {
    const result = inflateHealthcareCost(10000, 2026, 2026, 0.05);
    expect(result).toBeCloseTo(10000, 5);
  });

  test('inflateHealthcareCost inflates by 5% after one year', () => {
    const result = inflateHealthcareCost(10000, 2027, 2026, 0.05);
    expect(result).toBeCloseTo(10500, 1);
  });

  test('inflateHealthcareCost clamps to zero for past years', () => {
    const result = inflateHealthcareCost(10000, 2020, 2026, 0.05);
    expect(result).toBeCloseTo(10000, 5); // no deflation
  });

  test('estimateLifetimeHealthcareCost sums years correctly', () => {
    // 1 year: just the base amount
    const oneYear = estimateLifetimeHealthcareCost(10000, 2026, 2026, 0.05);
    expect(oneYear).toBeCloseTo(10000, 1);

    // 2 years: 10000 + 10500
    const twoYears = estimateLifetimeHealthcareCost(10000, 2026, 2027, 0.05);
    expect(twoYears).toBeCloseTo(20500, 0);
  });

  test('healthcareInflationPremium returns difference from general inflation', () => {
    const premium = healthcareInflationPremium(0.05, 0.025);
    expect(premium).toBeCloseTo(0.025, 5);
  });

  test('describeHealthcareInflation returns a non-empty string', () => {
    const desc = describeHealthcareInflation(0.05);
    expect(desc).toContain('5.0%');
    expect(desc).toContain('annual healthcare inflation');
  });
});

// ---------------------------------------------------------------------------
// 10. HealthcareAssumptionService
// ---------------------------------------------------------------------------

describe('HealthcareAssumptionService', () => {
  test('loadEffectiveHealthcareAssumptions uses defaults from input', () => {
    const snapshot = makeSnapshot(60);
    const input = makePlanningInput();
    const assumptions = loadEffectiveHealthcareAssumptions(input, snapshot);
    expect(assumptions.healthcareInflationRate).toBe(0.05);
    expect(assumptions.medicareEligibilityAge).toBe(65);
    expect(assumptions.ltcEnabled).toBe(false);
    expect(assumptions.longevityEnabled).toBe(false);
    expect(assumptions.includeSpouseHealthcare).toBe(false);
  });

  test('loadEffectiveHealthcareAssumptions builds member profiles from snapshot', () => {
    const snapshot = makeSnapshot(60, 58);
    const input = makePlanningInput({ includeSpouseHealthcare: true });
    const assumptions = loadEffectiveHealthcareAssumptions(input, snapshot);
    expect(assumptions.memberProfiles).toHaveLength(2);
    const primary = assumptions.memberProfiles.find((m) => m.isPrimary);
    const spouse = assumptions.memberProfiles.find((m) => m.isSpouse);
    expect(primary?.currentAge).toBe(60);
    expect(spouse?.currentAge).toBe(58);
  });

  test('getHealthcareCostMode returns pre_medicare before eligibility', () => {
    expect(getHealthcareCostMode(60, 65, true)).toBe('pre_medicare');
  });

  test('getHealthcareCostMode returns medicare at eligibility age', () => {
    expect(getHealthcareCostMode(65, 65, true)).toBe('medicare');
  });

  test('getHealthcareCostMode returns none when not alive', () => {
    expect(getHealthcareCostMode(70, 65, false)).toBe('none');
  });

  test('validateHealthcareAssumptions warns on very high inflation', () => {
    const snapshot = makeSnapshot(60);
    const input = makePlanningInput({ healthcareInflationRate: 0.12 });
    const assumptions = loadEffectiveHealthcareAssumptions(input, snapshot);
    const { valid, warnings } = validateHealthcareAssumptions(assumptions);
    expect(valid).toBe(true); // warnings don't block
    expect(warnings.some((w) => w.includes('10%'))).toBe(true);
  });

  test('validateHealthcareAssumptions passes with normal assumptions', () => {
    const snapshot = makeSnapshot(60);
    const input = makePlanningInput();
    const assumptions = loadEffectiveHealthcareAssumptions(input, snapshot);
    const { valid, warnings } = validateHealthcareAssumptions(assumptions);
    expect(valid).toBe(true);
    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 11. PreMedicareCostService
// ---------------------------------------------------------------------------

describe('PreMedicareCostService', () => {
  test('computeHouseholdPreMedicareCost single person returns primary cost only', () => {
    const result = computeHouseholdPreMedicareCost({
      config: preMedicareConfig,
      primaryAge: 60,
      spouseAge: undefined,
      medicareEligibilityAge: 65,
      includeSpouse: false,
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(result.primaryCost).toBeCloseTo(15000, 0);
    expect(result.spouseCost).toBe(0);
    expect(result.total).toBeCloseTo(15000, 0);
  });

  test('computeHouseholdPreMedicareCost couple both pre-Medicare', () => {
    const result = computeHouseholdPreMedicareCost({
      config: preMedicareConfig,
      primaryAge: 60,
      spouseAge: 58,
      medicareEligibilityAge: 65,
      includeSpouse: true,
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(result.primaryCost).toBeGreaterThan(0);
    expect(result.spouseCost).toBeGreaterThan(0);
    expect(result.total).toBeCloseTo(result.primaryCost + result.spouseCost, 5);
  });

  test('computeHouseholdPreMedicareCost primary Medicare-eligible returns 0 for primary', () => {
    const result = computeHouseholdPreMedicareCost({
      config: preMedicareConfig,
      primaryAge: 66,
      spouseAge: 60,
      medicareEligibilityAge: 65,
      includeSpouse: true,
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(result.primaryCost).toBe(0);
    expect(result.spouseCost).toBeGreaterThan(0);
  });

  test('preMedicareBridgeYearsRemaining returns 0 when already eligible', () => {
    expect(preMedicareBridgeYearsRemaining(65, 65)).toBe(0);
    expect(preMedicareBridgeYearsRemaining(70, 65)).toBe(0);
  });

  test('preMedicareBridgeYearsRemaining returns correct bridge years', () => {
    expect(preMedicareBridgeYearsRemaining(60, 65)).toBe(5);
    expect(preMedicareBridgeYearsRemaining(55, 65)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 12. MedicareCostService
// ---------------------------------------------------------------------------

describe('MedicareCostService', () => {
  test('computeHouseholdMedicareCost single Medicare-eligible person', () => {
    const result = computeHouseholdMedicareCost({
      config: medicareConfig,
      primaryAge: 65,
      spouseAge: undefined,
      medicareEligibilityAge: 65,
      includeSpouse: false,
      grossIncome: 50000,
      filingStatus: 'SINGLE',
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(result.primaryCost).toBeGreaterThan(0);
    expect(result.spouseCost).toBe(0);
    expect(result.total).toBe(result.primaryCost);
  });

  test('computeHouseholdMedicareCost couple both Medicare-eligible', () => {
    const result = computeHouseholdMedicareCost({
      config: medicareConfig,
      primaryAge: 68,
      spouseAge: 66,
      medicareEligibilityAge: 65,
      includeSpouse: true,
      grossIncome: 80000,
      filingStatus: 'MARRIED_FILING_JOINTLY',
      year: 2026,
      baseYear: 2026,
      healthcareInflationRate: 0.05,
    });
    expect(result.primaryCost).toBeGreaterThan(0);
    expect(result.spouseCost).toBeGreaterThan(0);
    expect(result.total).toBeCloseTo(result.primaryCost + result.spouseCost, 5);
  });

  test('describeMedicareCoverageConfig lists included parts', () => {
    const lines = describeMedicareCoverageConfig(medicareConfig);
    expect(lines.some((l) => l.includes('Part B'))).toBe(true);
    expect(lines.some((l) => l.includes('Part D'))).toBe(true);
    expect(lines.some((l) => l.includes('Medigap'))).toBe(true);
  });

  test('isIRMAASurchargeApplicable returns true above threshold', () => {
    expect(isIRMAASurchargeApplicable(150000, 'SINGLE')).toBe(true);
    expect(isIRMAASurchargeApplicable(50000, 'SINGLE')).toBe(false);
  });

  test('isIRMAASurchargeApplicable uses MFJ threshold for joint filers', () => {
    expect(isIRMAASurchargeApplicable(210000, 'MARRIED_FILING_JOINTLY')).toBe(true);
    expect(isIRMAASurchargeApplicable(150000, 'MARRIED_FILING_JOINTLY')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 13. LongTermCareStressService
// ---------------------------------------------------------------------------

describe('LongTermCareStressService', () => {
  test('computeLtcStressResult returns 0 when disabled', () => {
    const result = computeLtcStressResult(
      { ...ltcConfig, enabled: false },
      80, 2026, 2026, 0.05,
    );
    expect(result.ltcCost).toBe(0);
    expect(result.ltcActive).toBe(false);
    expect(result.cumulativeLtcCost).toBe(0);
  });

  test('computeLtcStressResult returns cost when in range', () => {
    const result = computeLtcStressResult(ltcConfig, 80, 2026, 2026, 0.05);
    expect(result.ltcCost).toBeCloseTo(90000, 0);
    expect(result.ltcActive).toBe(true);
    expect(result.cumulativeLtcCost).toBeCloseTo(90000, 0);
  });

  test('computeLtcStressResult accumulates cumulative cost', () => {
    const first = computeLtcStressResult(ltcConfig, 80, 2026, 2026, 0.05, 0);
    const second = computeLtcStressResult(ltcConfig, 81, 2027, 2026, 0.05, first.cumulativeLtcCost);
    expect(second.cumulativeLtcCost).toBeGreaterThan(first.cumulativeLtcCost);
  });

  test('computeLtcStressResult returns 0 after LTC ends', () => {
    const result = computeLtcStressResult(ltcConfig, 83, 2026, 2026, 0.05);
    expect(result.ltcCost).toBe(0);
    expect(result.ltcActive).toBe(false);
  });

  test('summarizeLtcStress returns zeros when disabled', () => {
    const result = summarizeLtcStress(
      { ...ltcConfig, enabled: false },
      2026, 55, 0.05,
    );
    expect(result.totalLtcCost).toBe(0);
    expect(result.activeYears).toBe(0);
  });

  test('summarizeLtcStress sums total cost for active years', () => {
    // primary age at start = 55, ltc starts at 80 (25 years away), duration 3 years
    const result = summarizeLtcStress(ltcConfig, 2026, 55, 0.05);
    expect(result.totalLtcCost).toBeGreaterThan(0);
    expect(result.activeYears).toBe(3);
    expect(result.peakAnnualCost).toBeGreaterThan(0);
  });

  test('LTC_NATIONAL_AVERAGES_2024 has expected keys', () => {
    expect(LTC_NATIONAL_AVERAGES_2024.homeHealthAide_annual).toBeGreaterThan(0);
    expect(LTC_NATIONAL_AVERAGES_2024.assistedLiving_annual).toBeGreaterThan(0);
    expect(LTC_NATIONAL_AVERAGES_2024.nursingHomeSemiPrivate_annual).toBeGreaterThan(0);
  });
});
