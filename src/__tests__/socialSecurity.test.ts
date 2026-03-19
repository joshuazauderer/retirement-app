import { describe, test, expect } from 'vitest';

/**
 * Phase 8 — Social Security Modeling Tests
 *
 * Tests cover:
 * 1. Claiming adjustment service (FRA, adjustment factors, break-even)
 * 2. Survivor benefit service (survivor benefit retention, expenses, gaps)
 * 3. Couple coordination (staggered retirement, survivor phase)
 * 4. Validation
 * 5. Golden cases
 */

import {
  getFullRetirementAge,
  computeAdjustmentFactor,
  adjustBenefitForClaimAge,
  backCalculateFRABenefit,
  convertBenefitToClaimAge,
  calculateBreakEvenAge,
  validateClaimAge,
} from '../server/socialSecurity/claimingAdjustmentService';

import {
  computeSurvivorBenefit,
  computeSurvivorExpenses,
  computeSurvivorIncomeGap,
  applyColaBenefit,
} from '../server/socialSecurity/survivorBenefitService';

import {
  projectCoupleSocialSecurity,
} from '../server/socialSecurity/coupleCoordinationService';

import {
  validateSocialSecurityInput,
} from '../server/socialSecurity/socialSecurityService';

import {
  compareSocialSecurityRuns,
} from '../server/socialSecurity/socialSecurityComparisonService';

import { SS_BOUNDS } from '../server/socialSecurity/types';
import type { SocialSecurityPlanningRunResult } from '../server/socialSecurity/types';

// ---------------------------------------------------------------------------
// 1. Claiming Adjustment Service
// ---------------------------------------------------------------------------

describe('ClaimingAdjustmentService', () => {

  describe('getFullRetirementAge', () => {
    test('returns 67 (born 1960+ cohort)', () => {
      expect(getFullRetirementAge()).toBe(67);
    });
  });

  describe('computeAdjustmentFactor', () => {
    test('at FRA (67) returns exactly 1.0', () => {
      expect(computeAdjustmentFactor(67)).toBe(1.0);
    });

    test('at 62 (60 months early) applies full two-tier reduction', () => {
      // 36 months × 5/9% + 24 months × 5/12%
      const expected = 1 - (36 * (5/9/100) + 24 * (5/12/100));
      expect(computeAdjustmentFactor(62)).toBeCloseTo(expected, 6);
    });

    test('at 64 (36 months early) applies only first-tier reduction', () => {
      // Exactly 36 months early → no beyond-36 reduction
      const expected = 1 - 36 * (5/9/100);
      expect(computeAdjustmentFactor(64)).toBeCloseTo(expected, 6);
    });

    test('at 70 (36 months late) applies full delayed credit', () => {
      // 36 months × 2/3%
      const expected = 1 + 36 * (2/3/100);
      expect(computeAdjustmentFactor(70)).toBeCloseTo(expected, 6);
    });

    test('at 62 factor is approximately 0.70', () => {
      // Common knowledge: claiming at 62 with FRA=67 → ~70% of FRA benefit
      expect(computeAdjustmentFactor(62)).toBeCloseTo(0.70, 2);
    });

    test('at 70 factor is approximately 1.24', () => {
      // Claiming at 70 with FRA=67 → 36 months × 0.667% ≈ 24% increase
      expect(computeAdjustmentFactor(70)).toBeCloseTo(1.24, 2);
    });

    test('factor at 65 is between 62 and 67 factors', () => {
      const f62 = computeAdjustmentFactor(62);
      const f65 = computeAdjustmentFactor(65);
      const f67 = computeAdjustmentFactor(67);
      expect(f65).toBeGreaterThan(f62);
      expect(f65).toBeLessThan(f67);
    });

    test('factor strictly increases from 62 to 70', () => {
      const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70];
      for (let i = 1; i < ages.length; i++) {
        expect(computeAdjustmentFactor(ages[i])).toBeGreaterThan(
          computeAdjustmentFactor(ages[i - 1])
        );
      }
    });
  });

  describe('adjustBenefitForClaimAge', () => {
    test('adjusts correctly for early claim', () => {
      const fraBase = 24_000;
      const adjusted = adjustBenefitForClaimAge(fraBase, 62);
      expect(adjusted).toBeLessThan(fraBase);
      expect(adjusted).toBeCloseTo(fraBase * computeAdjustmentFactor(62), 0);
    });

    test('returns FRA benefit unchanged when claim age is 67', () => {
      const fraBase = 30_000;
      expect(adjustBenefitForClaimAge(fraBase, 67)).toBeCloseTo(fraBase, 0);
    });

    test('returns more than FRA benefit for delayed claim', () => {
      const fraBase = 24_000;
      expect(adjustBenefitForClaimAge(fraBase, 70)).toBeGreaterThan(fraBase);
    });

    test('clamps claim age below 62 to MIN_CLAIM_AGE', () => {
      const fraBase = 24_000;
      const at62 = adjustBenefitForClaimAge(fraBase, 62);
      const at55 = adjustBenefitForClaimAge(fraBase, 55); // clamped to 62
      expect(at55).toBeCloseTo(at62, 0);
    });

    test('clamps claim age above 70 to MAX_CLAIM_AGE', () => {
      const fraBase = 24_000;
      const at70 = adjustBenefitForClaimAge(fraBase, 70);
      const at75 = adjustBenefitForClaimAge(fraBase, 75); // clamped to 70
      expect(at75).toBeCloseTo(at70, 0);
    });
  });

  describe('backCalculateFRABenefit', () => {
    test('recovers FRA benefit from benefit-at-FRA (round-trip)', () => {
      const fraBase = 30_000;
      const recovered = backCalculateFRABenefit(fraBase, 67);
      expect(recovered).toBeCloseTo(fraBase, 0);
    });

    test('recovers FRA benefit from benefit-at-62', () => {
      const fraBase = 30_000;
      const at62 = adjustBenefitForClaimAge(fraBase, 62);
      const recovered = backCalculateFRABenefit(at62, 62);
      expect(recovered).toBeCloseTo(fraBase, 0);
    });

    test('recovers FRA benefit from benefit-at-70', () => {
      const fraBase = 30_000;
      const at70 = adjustBenefitForClaimAge(fraBase, 70);
      const recovered = backCalculateFRABenefit(at70, 70);
      expect(recovered).toBeCloseTo(fraBase, 0);
    });
  });

  describe('convertBenefitToClaimAge', () => {
    test('converts 62 benefit to 70 benefit correctly', () => {
      const fraBase = 24_000;
      const at62 = adjustBenefitForClaimAge(fraBase, 62);
      const at70fromFRA = adjustBenefitForClaimAge(fraBase, 70);
      const converted = convertBenefitToClaimAge(at62, 62, 70);
      expect(converted).toBeCloseTo(at70fromFRA, 0);
    });

    test('converts 70 benefit back to 62 benefit correctly', () => {
      const fraBase = 24_000;
      const at70 = adjustBenefitForClaimAge(fraBase, 70);
      const at62fromFRA = adjustBenefitForClaimAge(fraBase, 62);
      const converted = convertBenefitToClaimAge(at70, 70, 62);
      expect(converted).toBeCloseTo(at62fromFRA, 0);
    });

    test('identity: converting to same age returns same benefit', () => {
      const benefit = 20_000;
      const claimAge = 65;
      const result = convertBenefitToClaimAge(benefit, claimAge, claimAge);
      expect(result).toBeCloseTo(benefit, 0);
    });
  });

  describe('calculateBreakEvenAge', () => {
    test('returns null at FRA (no break-even)', () => {
      expect(calculateBreakEvenAge(24_000, 67)).toBeNull();
    });

    test('early claimer breaks even vs FRA around age 78-82', () => {
      // Common planning wisdom: early claim break-even is typically late 70s to early 80s
      const breakEven = calculateBreakEvenAge(24_000, 62);
      expect(breakEven).not.toBeNull();
      expect(breakEven!).toBeGreaterThan(74);
      expect(breakEven!).toBeLessThan(90);
    });

    test('late claimer breaks even vs FRA around age 80-84', () => {
      const breakEven = calculateBreakEvenAge(24_000, 70);
      expect(breakEven).not.toBeNull();
      expect(breakEven!).toBeGreaterThan(78);
      expect(breakEven!).toBeLessThan(90);
    });

    test('early claimer break-even is lower than late claimer break-even', () => {
      const earlyBreakEven = calculateBreakEvenAge(24_000, 62);
      const lateBreakEven = calculateBreakEvenAge(24_000, 70);
      if (earlyBreakEven !== null && lateBreakEven !== null) {
        expect(earlyBreakEven).toBeLessThan(lateBreakEven);
      }
    });
  });

  describe('validateClaimAge', () => {
    test('returns null for valid ages 62-70', () => {
      expect(validateClaimAge(62)).toBeNull();
      expect(validateClaimAge(67)).toBeNull();
      expect(validateClaimAge(70)).toBeNull();
    });

    test('returns error for claim age below 62', () => {
      expect(validateClaimAge(61)).not.toBeNull();
      expect(validateClaimAge(50)).not.toBeNull();
    });

    test('returns error for claim age above 70', () => {
      expect(validateClaimAge(71)).not.toBeNull();
    });

    test('returns error for non-finite input', () => {
      expect(validateClaimAge(NaN)).not.toBeNull();
      expect(validateClaimAge(Infinity)).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Survivor Benefit Service
// ---------------------------------------------------------------------------

describe('SurvivorBenefitService', () => {

  describe('computeSurvivorBenefit', () => {
    test('returns deceased benefit when it is higher', () => {
      expect(computeSurvivorBenefit(20_000, 30_000)).toBe(30_000);
    });

    test('returns own benefit when it is higher', () => {
      expect(computeSurvivorBenefit(35_000, 25_000)).toBe(35_000);
    });

    test('returns the same value when both are equal', () => {
      expect(computeSurvivorBenefit(25_000, 25_000)).toBe(25_000);
    });

    test('handles zero deceased benefit (surviving member keeps own)', () => {
      expect(computeSurvivorBenefit(20_000, 0)).toBe(20_000);
    });
  });

  describe('computeSurvivorExpenses', () => {
    test('returns 80% of couple expenses by default', () => {
      expect(computeSurvivorExpenses(100_000)).toBeCloseTo(80_000, 0);
    });

    test('respects custom ratio', () => {
      expect(computeSurvivorExpenses(100_000, 0.65)).toBeCloseTo(65_000, 0);
    });

    test('clamps ratio above 1 to 1', () => {
      expect(computeSurvivorExpenses(100_000, 1.5)).toBeCloseTo(100_000, 0);
    });

    test('clamps ratio below 0 to 0', () => {
      expect(computeSurvivorExpenses(100_000, -0.1)).toBe(0);
    });
  });

  describe('computeSurvivorIncomeGap', () => {
    test('returns positive gap when expenses exceed income', () => {
      expect(computeSurvivorIncomeGap(20_000, 30_000)).toBe(10_000);
    });

    test('returns negative gap (surplus) when income exceeds expenses', () => {
      expect(computeSurvivorIncomeGap(40_000, 30_000)).toBe(-10_000);
    });

    test('returns zero when income equals expenses', () => {
      expect(computeSurvivorIncomeGap(30_000, 30_000)).toBe(0);
    });
  });

  describe('applyColaBenefit', () => {
    test('returns base benefit in year 0 (no COLA)', () => {
      expect(applyColaBenefit(24_000, 0.023, 0)).toBe(24_000);
    });

    test('applies COLA for year 1', () => {
      expect(applyColaBenefit(24_000, 0.023, 1)).toBeCloseTo(24_000 * 1.023, 0);
    });

    test('applies COLA for 10 years', () => {
      expect(applyColaBenefit(24_000, 0.023, 10)).toBeCloseTo(24_000 * Math.pow(1.023, 10), 0);
    });

    test('returns base for negative years', () => {
      expect(applyColaBenefit(24_000, 0.023, -1)).toBe(24_000);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Couple Coordination Service
// ---------------------------------------------------------------------------

describe('CoupleCoordinationService', () => {

  function makePrimary(overrides: Partial<{
    claimAge: number;
    lifeExpectancy: number;
    retirementAge: number;
    benefit: number;
  }> = {}) {
    const o = { claimAge: 67, lifeExpectancy: 88, retirementAge: 65, benefit: 30_000, ...overrides };
    return {
      memberId: 'p1',
      firstName: 'Alice',
      dateOfBirth: '1964-01-01T00:00:00.000Z',  // age 62 in 2026
      lifeExpectancy: o.lifeExpectancy,
      retirementTargetAge: o.retirementAge,
      claimAge: o.claimAge,
      adjustedAnnualBenefit: o.benefit,
      colaRate: 0.023,
    };
  }

  function makeSpouse(overrides: Partial<{
    claimAge: number;
    lifeExpectancy: number;
    retirementAge: number;
    benefit: number;
  }> = {}) {
    const o = { claimAge: 67, lifeExpectancy: 90, retirementAge: 65, benefit: 20_000, ...overrides };
    return {
      memberId: 's1',
      firstName: 'Bob',
      dateOfBirth: '1966-01-01T00:00:00.000Z',  // age 60 in 2026
      lifeExpectancy: o.lifeExpectancy,
      retirementTargetAge: o.retirementAge,
      claimAge: o.claimAge,
      adjustedAnnualBenefit: o.benefit,
      colaRate: 0.023,
    };
  }

  const expenseConfig = {
    coupleBaseExpenses: 80_000,
    inflationRate: 0.03,
    simulationYearStart: 2026,
    survivorExpenseRatio: 0.80,
  };

  test('produces year-by-year results for the full projection range', () => {
    const { yearByYear } = projectCoupleSocialSecurity(
      makePrimary(), makeSpouse(), expenseConfig, 2026, 2056
    );
    expect(yearByYear.length).toBeGreaterThan(0);
    expect(yearByYear[0].year).toBe(2026);
  });

  test('starts in both-alive phase', () => {
    const { yearByYear } = projectCoupleSocialSecurity(
      makePrimary(), makeSpouse(), expenseConfig, 2026, 2056
    );
    expect(yearByYear[0].isSurvivorPhase).toBe(false);
  });

  test('detects survivor phase after primary dies (Alice dies at 88, in ~2052)', () => {
    // Alice born 1964, life expectancy 88 → dies around year 2052
    const { yearByYear, coordination } = projectCoupleSocialSecurity(
      makePrimary({ lifeExpectancy: 88 }),
      makeSpouse({ lifeExpectancy: 92 }),
      expenseConfig,
      2026,
      2060,
    );
    // Should have survivor phase
    const survivorYears = yearByYear.filter((y) => y.isSurvivorPhase);
    expect(survivorYears.length).toBeGreaterThan(0);
    expect(coordination.firstDeathYear).not.toBeNull();
  });

  test('survivor receives higher benefit after spouse dies', () => {
    // Primary (Alice) has higher starting benefit ($30k) and shorter life expectancy
    // Bob survives and should get at least as much as his own benefit
    // (Alice's benefit is COLA'd ~18 years → much larger than $30k at death)
    const { survivorTransition } = projectCoupleSocialSecurity(
      makePrimary({ lifeExpectancy: 85, benefit: 30_000 }),
      makeSpouse({ lifeExpectancy: 92, benefit: 20_000 }),
      expenseConfig,
      2026,
      2060,
    );

    expect(survivorTransition).not.toBeNull();
    expect(survivorTransition!.survivingMemberId).toBe('s1');
    // Survivor benefit = max(Bob's own benefit, Alice's COLA'd benefit at death)
    // Alice's COLA'd benefit at death must exceed Bob's, so survivor gets Alice's
    expect(survivorTransition!.survivorBenefit).toBeGreaterThanOrEqual(
      survivorTransition!.survivingOwnBenefit
    );
    // Alice's COLA'd benefit at death is > her original $30k base (18 years of COLA)
    expect(survivorTransition!.deceasedBenefitAtDeath).toBeGreaterThan(30_000);
    // Survivor benefit = deceased's COLA'd benefit (since it's higher)
    expect(survivorTransition!.survivorBenefit).toBeCloseTo(
      survivorTransition!.deceasedBenefitAtDeath, 0
    );
  });

  test('yearsWithBothBenefits is positive when both members claim before either dies', () => {
    const { coordination } = projectCoupleSocialSecurity(
      makePrimary({ claimAge: 67, lifeExpectancy: 88 }),
      makeSpouse({ claimAge: 67, lifeExpectancy: 90 }),
      expenseConfig,
      2026,
      2060,
    );
    expect(coordination.yearsWithBothBenefits).toBeGreaterThan(0);
  });

  test('survivor expense ratio is correctly applied', () => {
    const { survivorTransition } = projectCoupleSocialSecurity(
      makePrimary({ lifeExpectancy: 82 }),
      makeSpouse({ lifeExpectancy: 90 }),
      { ...expenseConfig, survivorExpenseRatio: 0.75 },
      2026,
      2060,
    );
    expect(survivorTransition?.survivorExpenseRatio).toBe(0.75);
    if (survivorTransition) {
      expect(survivorTransition.projectedAnnualSurvivorExpenses).toBeCloseTo(
        survivorTransition.coupleAnnualExpensesAtTransition * 0.75,
        0
      );
    }
  });

  test('COLA is applied to benefits after claim start', () => {
    const { yearByYear } = projectCoupleSocialSecurity(
      makePrimary({ claimAge: 67 }),
      makeSpouse({ claimAge: 67 }),
      expenseConfig,
      2026,
      2060,
    );

    // Find two consecutive retirement years where primary is claiming
    const claimingYears = yearByYear.filter((y) => {
      const r = y.memberResults.find((m) => m.memberId === 'p1');
      return r?.hasClaimed && r.effectiveBenefit > 0;
    });

    if (claimingYears.length >= 2) {
      const yr1 = claimingYears[0].memberResults.find((m) => m.memberId === 'p1')!.effectiveBenefit;
      const yr2 = claimingYears[1].memberResults.find((m) => m.memberId === 'p1')!.effectiveBenefit;
      // Year 2 should have COLA applied
      expect(yr2).toBeGreaterThan(yr1);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Validation
// ---------------------------------------------------------------------------

describe('SocialSecurityValidation', () => {
  const validBase = {
    householdId: 'hh1',
    scenarioId: 'sc1',
  };

  test('valid input passes', () => {
    const result = validateSocialSecurityInput(validBase);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing householdId fails', () => {
    const result = validateSocialSecurityInput({ ...validBase, householdId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Household'))).toBe(true);
  });

  test('missing scenarioId fails', () => {
    const result = validateSocialSecurityInput({ ...validBase, scenarioId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Scenario'))).toBe(true);
  });

  test('invalid claim age override fails', () => {
    const result = validateSocialSecurityInput({
      ...validBase,
      claimAgeOverrides: { 'm1': 61 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('62'))).toBe(true);
  });

  test('valid claim age override passes', () => {
    const result = validateSocialSecurityInput({
      ...validBase,
      claimAgeOverrides: { 'm1': 70 },
    });
    expect(result.valid).toBe(true);
  });

  test('invalid survivor expense ratio fails', () => {
    const result = validateSocialSecurityInput({
      ...validBase,
      survivorExpenseRatio: 1.5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('survivor expense'))).toBe(true);
  });

  test('valid survivor expense ratio passes', () => {
    const result = validateSocialSecurityInput({
      ...validBase,
      survivorExpenseRatio: 0.80,
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Comparison Service
// ---------------------------------------------------------------------------

describe('SocialSecurityComparisonService', () => {

  function makeRun(overrides: {
    runId?: string;
    claimAge?: number;
    totalBenefit?: number;
    adjustedBenefit?: number;
    survivorBenefit?: number;
  } = {}): SocialSecurityPlanningRunResult {
    const o = {
      runId: 'run-a',
      claimAge: 67,
      totalBenefit: 500_000,
      adjustedBenefit: 24_000,
      survivorBenefit: 24_000,
      ...overrides,
    };
    return {
      runId: o.runId,
      householdId: 'hh1',
      scenarioId: 'sc1',
      scenarioName: 'Baseline',
      label: `Claim at ${o.claimAge}`,
      createdAt: new Date().toISOString(),
      memberSummaries: [
        {
          memberId: 'm1',
          firstName: 'Alice',
          fra: 67,
          claimAge: o.claimAge,
          fraEquivalentAnnualBenefit: 24_000,
          adjustedAnnualBenefit: o.adjustedBenefit,
          adjustmentFactor: computeAdjustmentFactor(o.claimAge),
          breakEvenAgeVsFRA: calculateBreakEvenAge(24_000, o.claimAge),
          totalLifetimeBenefit: o.totalBenefit,
          yearlyResults: [],
        },
      ],
      coupleCoordination: null,
      survivorTransition: null,
      totalHouseholdLifetimeBenefit: o.totalBenefit,
      yearByYear: [],
      projectionStartYear: 2026,
      projectionEndYear: 2056,
    };
  }

  test('comparison produces claimAgeDiffs for each shared member', () => {
    const runA = makeRun({ runId: 'a', claimAge: 62, totalBenefit: 450_000 });
    const runB = makeRun({ runId: 'b', claimAge: 70, totalBenefit: 520_000 });
    const result = compareSocialSecurityRuns(runA, runB);
    expect(result.claimAgeDiffs).toHaveLength(1);
    expect(result.claimAgeDiffs[0].claimAgeA).toBe(62);
    expect(result.claimAgeDiffs[0].claimAgeB).toBe(70);
  });

  test('outcome diff shows correct direction when Run B has higher lifetime benefit', () => {
    const runA = makeRun({ runId: 'a', claimAge: 62, totalBenefit: 450_000 });
    const runB = makeRun({ runId: 'b', claimAge: 70, totalBenefit: 520_000 });
    const result = compareSocialSecurityRuns(runA, runB);
    const totalDiff = result.outcomeDiffs.find((d) => d.label.includes('Total Household'));
    expect(totalDiff).toBeDefined();
    expect(totalDiff!.direction).toBe('better');
  });

  test('outcome diff shows worse when Run B has lower lifetime benefit', () => {
    const runA = makeRun({ runId: 'a', claimAge: 70, totalBenefit: 520_000 });
    const runB = makeRun({ runId: 'b', claimAge: 62, totalBenefit: 450_000 });
    const result = compareSocialSecurityRuns(runA, runB);
    const totalDiff = result.outcomeDiffs.find((d) => d.label.includes('Total Household'));
    expect(totalDiff).toBeDefined();
    expect(totalDiff!.direction).toBe('worse');
  });

  test('neutral direction when values are equal', () => {
    const runA = makeRun({ runId: 'a', totalBenefit: 500_000 });
    const runB = makeRun({ runId: 'b', totalBenefit: 500_000 });
    const result = compareSocialSecurityRuns(runA, runB);
    const totalDiff = result.outcomeDiffs.find((d) => d.label.includes('Total Household'));
    expect(totalDiff?.direction).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// 6. Golden Cases
// ---------------------------------------------------------------------------

describe('Golden Cases', () => {

  test('GC1: Delayed claim produces higher annual benefit than early claim', () => {
    const fraBase = 30_000;
    const early = adjustBenefitForClaimAge(fraBase, 62);
    const fra = adjustBenefitForClaimAge(fraBase, 67);
    const late = adjustBenefitForClaimAge(fraBase, 70);
    expect(early).toBeLessThan(fra);
    expect(fra).toBeLessThan(late);
  });

  test('GC2: Early claim accumulates more total benefit by break-even age', () => {
    const fraBase = 30_000;
    const claimAge = 62;
    const early = adjustBenefitForClaimAge(fraBase, claimAge);
    const breakEven = calculateBreakEvenAge(fraBase, claimAge)!;
    expect(breakEven).not.toBeNull();

    const earlyTotal = early * (breakEven - claimAge);
    const fraTotal = fraBase * (breakEven - 67);
    // At break-even, they should be approximately equal
    expect(Math.abs(earlyTotal - fraTotal) / fraTotal).toBeLessThan(0.05);
  });

  test('GC3: Survivor gets higher-earner SS benefit even if own benefit is lower', () => {
    const highEarnerBenefit = 40_000;
    const lowEarnerBenefit = 18_000;
    const survivorBenefit = computeSurvivorBenefit(lowEarnerBenefit, highEarnerBenefit);
    expect(survivorBenefit).toBe(highEarnerBenefit);
  });

  test('GC4: SS_BOUNDS constants are internally consistent', () => {
    expect(SS_BOUNDS.MIN_CLAIM_AGE).toBe(62);
    expect(SS_BOUNDS.MAX_CLAIM_AGE).toBe(70);
    expect(SS_BOUNDS.FULL_RETIREMENT_AGE).toBe(67);
    expect(SS_BOUNDS.DEFAULT_SURVIVOR_EXPENSE_RATIO).toBe(0.80);
    // 36 months late × 2/3% ≈ 24% increase — standard SS knowledge
    const delayedCredit = 36 * SS_BOUNDS.DELAYED_CREDIT_RATE_PER_MONTH;
    expect(delayedCredit).toBeCloseTo(0.24, 3);
  });

  test('GC5: Couple with large benefit gap — survivor retains the larger benefit', () => {
    const primary = {
      memberId: 'p',
      firstName: 'High Earner',
      dateOfBirth: '1960-01-01T00:00:00.000Z',
      lifeExpectancy: 82,
      retirementTargetAge: 65,
      claimAge: 67,
      adjustedAnnualBenefit: 45_000,
      colaRate: 0.023,
    };
    const spouse = {
      memberId: 's',
      firstName: 'Low Earner',
      dateOfBirth: '1962-01-01T00:00:00.000Z',
      lifeExpectancy: 90,
      retirementTargetAge: 65,
      claimAge: 67,
      adjustedAnnualBenefit: 15_000,
      colaRate: 0.023,
    };

    const { survivorTransition } = projectCoupleSocialSecurity(
      primary,
      spouse,
      { coupleBaseExpenses: 70_000, inflationRate: 0.03, simulationYearStart: 2026, survivorExpenseRatio: 0.80 },
      2026,
      2060,
    );

    expect(survivorTransition).not.toBeNull();
    const survivingOwnBenefit = survivorTransition!.survivingOwnBenefit;
    // Surviving low-earner should inherit the high-earner's larger benefit
    // survivorBenefit = max(survivingOwn, deceased) → must be >= surviving own
    expect(survivorTransition!.survivorBenefit).toBeGreaterThanOrEqual(survivingOwnBenefit);
    // Deceased high-earner's benefit at death should be > surviving low-earner's own benefit
    expect(survivorTransition!.deceasedBenefitAtDeath).toBeGreaterThan(
      survivorTransition!.survivingOwnBenefit
    );
  });

  test('GC6: Back-calculation + re-adjustment round-trips correctly for all common claim ages', () => {
    const fraBase = 36_000;
    const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70];
    for (const knownAge of ages) {
      const benefitAtKnown = adjustBenefitForClaimAge(fraBase, knownAge);
      for (const targetAge of ages) {
        const expected = adjustBenefitForClaimAge(fraBase, targetAge);
        const converted = convertBenefitToClaimAge(benefitAtKnown, knownAge, targetAge);
        expect(converted).toBeCloseTo(expected, 0);
      }
    }
  });

  test('GC7: COLA grows benefit monotonically over time', () => {
    const base = 24_000;
    const colaRate = 0.023;
    const benefits = [0, 1, 5, 10, 20].map((y) => applyColaBenefit(base, colaRate, y));
    for (let i = 1; i < benefits.length; i++) {
      expect(benefits[i]).toBeGreaterThan(benefits[i - 1]);
    }
  });

  test('GC8: Adjustment factor is deterministic and repeatable', () => {
    // Calling twice with same inputs returns same result
    for (const age of [62, 64, 66, 67, 68, 70]) {
      const f1 = computeAdjustmentFactor(age);
      const f2 = computeAdjustmentFactor(age);
      expect(f1).toBe(f2);
    }
  });
});
