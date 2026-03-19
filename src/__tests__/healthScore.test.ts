/**
 * Phase 18 — Retirement Health Score Tests
 * Tests for component scorers and tier logic.
 * All scorers are pure functions — no DB mocking required.
 */

import { describe, test, expect } from 'vitest';
import {
  scorePortfolioSufficiency,
  scoreIncomeReplacement,
  scoreDebtLoad,
  scoreHealthcarePreparedness,
  scoreLongevityCoverage,
  scoreEmergencyBuffer,
  scoreProfileCompleteness,
  computeAllComponents,
} from '../server/health/healthScoreComponentService';
import {
  tierFromPercentage,
  COMPONENT_MAX_POINTS,
  TIER_THRESHOLDS,
  HealthScoreTier,
} from '../server/health/types';
import type { ComponentInput } from '../server/health/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseInput: ComponentInput = {
  totalAssets:                  500_000,
  totalLiabilities:             50_000,
  totalRealEstateValue:         400_000,
  totalRealEstateMortgageDebt:  100_000,
  totalLiquidAssets:            60_000,
  annualRetirementExpenses:     60_000,
  annualGuaranteedIncome:       36_000,  // 60% replacement
  profileCompletionPct:         90,
  latestSimulation: {
    endingBalance:       250_000,
    projectionEndYear:   2055,
    projectionStartYear: 2026,
    firstDepletionYear:  null,
    success:             true,
  },
  hasHealthcarePlan:           true,
  primaryMemberCurrentAge:     60,
  primaryMemberLifeExpectancy: 90,
  simulationYearStart:         2026,
};

function withOverrides(overrides: Partial<ComponentInput>): ComponentInput {
  return { ...baseInput, ...overrides };
}

// ─── tierFromPercentage ───────────────────────────────────────────────────────

describe('tierFromPercentage', () => {
  test('100 → EXCELLENT', () => expect(tierFromPercentage(100)).toBe('EXCELLENT'));
  test('90  → EXCELLENT', () => expect(tierFromPercentage(90)).toBe('EXCELLENT'));
  test('89  → GOOD',      () => expect(tierFromPercentage(89)).toBe('GOOD'));
  test('75  → GOOD',      () => expect(tierFromPercentage(75)).toBe('GOOD'));
  test('74  → FAIR',      () => expect(tierFromPercentage(74)).toBe('FAIR'));
  test('60  → FAIR',      () => expect(tierFromPercentage(60)).toBe('FAIR'));
  test('59  → AT_RISK',   () => expect(tierFromPercentage(59)).toBe('AT_RISK'));
  test('40  → AT_RISK',   () => expect(tierFromPercentage(40)).toBe('AT_RISK'));
  test('39  → CRITICAL',  () => expect(tierFromPercentage(39)).toBe('CRITICAL'));
  test('0   → CRITICAL',  () => expect(tierFromPercentage(0)).toBe('CRITICAL'));
});

// ─── scorePortfolioSufficiency ────────────────────────────────────────────────

describe('scorePortfolioSufficiency', () => {
  const max = COMPONENT_MAX_POINTS.portfolio_sufficiency; // 30

  test('full points when simulation succeeds with positive balance', () => {
    const c = scorePortfolioSufficiency(baseInput);
    expect(c.earnedPoints).toBe(30);
    expect(c.key).toBe('portfolio_sufficiency');
    expect(c.maxPoints).toBe(max);
  });

  test('zero points when no simulation', () => {
    const c = scorePortfolioSufficiency(withOverrides({ latestSimulation: null }));
    expect(c.earnedPoints).toBe(0);
    expect(c.actionUrl).toBe('/app/simulations');
  });

  test('5 points when depletion year recorded', () => {
    const c = scorePortfolioSufficiency(withOverrides({
      latestSimulation: {
        ...baseInput.latestSimulation!,
        firstDepletionYear: 2040,
        success: false,
      },
    }));
    expect(c.earnedPoints).toBe(5);
  });

  test('5 points when ending balance negative', () => {
    const c = scorePortfolioSufficiency(withOverrides({
      latestSimulation: {
        ...baseInput.latestSimulation!,
        endingBalance: -10_000,
        success: false,
      },
    }));
    expect(c.earnedPoints).toBe(5);
  });

  test('actionLabel is null when full points earned', () => {
    const c = scorePortfolioSufficiency(baseInput);
    expect(c.actionLabel).toBeNull();
  });

  test('percentage computed correctly', () => {
    const c = scorePortfolioSufficiency(baseInput);
    expect(c.percentage).toBe(100);
  });
});

// ─── scoreIncomeReplacement ───────────────────────────────────────────────────

describe('scoreIncomeReplacement', () => {
  test('20 pts for ≥80% replacement', () => {
    const c = scoreIncomeReplacement(withOverrides({ annualGuaranteedIncome: 50_000 }));
    // 50k / 60k = 83%
    expect(c.earnedPoints).toBe(20);
  });

  test('15 pts for 60–79% replacement', () => {
    const c = scoreIncomeReplacement(baseInput);
    // 36k / 60k = 60%
    expect(c.earnedPoints).toBe(15);
  });

  test('10 pts for 40–59% replacement', () => {
    const c = scoreIncomeReplacement(withOverrides({ annualGuaranteedIncome: 24_000 }));
    // 24k / 60k = 40%
    expect(c.earnedPoints).toBe(10);
  });

  test('5 pts for 20–39% replacement', () => {
    const c = scoreIncomeReplacement(withOverrides({ annualGuaranteedIncome: 12_000 }));
    // 12k / 60k = 20%
    expect(c.earnedPoints).toBe(5);
  });

  test('0 pts for <20% replacement', () => {
    const c = scoreIncomeReplacement(withOverrides({ annualGuaranteedIncome: 6_000 }));
    // 6k / 60k = 10%
    expect(c.earnedPoints).toBe(0);
  });

  test('0 pts and CTA when no expense data', () => {
    const c = scoreIncomeReplacement(withOverrides({ annualRetirementExpenses: 0 }));
    expect(c.earnedPoints).toBe(0);
    expect(c.actionUrl).toBe('/app/expenses');
  });
});

// ─── scoreDebtLoad ────────────────────────────────────────────────────────────

describe('scoreDebtLoad', () => {
  test('10 pts for ≤10% debt ratio', () => {
    // totalAssets=500k+400k=900k, totalDebt=50k+100k=150k → ratio=16.7%... let's force low
    const c = scoreDebtLoad(withOverrides({
      totalLiabilities: 0,
      totalRealEstateMortgageDebt: 10_000,
      totalAssets: 500_000,
      totalRealEstateValue: 400_000,
    }));
    // 10k / 900k = 1.1%
    expect(c.earnedPoints).toBe(10);
  });

  test('8 pts for 11–25% debt ratio', () => {
    const c = scoreDebtLoad(withOverrides({
      totalLiabilities: 100_000,
      totalRealEstateMortgageDebt: 100_000,
      totalAssets: 500_000,
      totalRealEstateValue: 400_000,
    }));
    // 200k / 900k = 22.2%
    expect(c.earnedPoints).toBe(8);
  });

  test('5 pts for 26–40% debt ratio', () => {
    const c = scoreDebtLoad(withOverrides({
      totalLiabilities: 200_000,
      totalRealEstateMortgageDebt: 150_000,
      totalAssets: 500_000,
      totalRealEstateValue: 400_000,
    }));
    // 350k / 900k = 38.9%
    expect(c.earnedPoints).toBe(5);
  });

  test('0 pts when no asset data', () => {
    const c = scoreDebtLoad(withOverrides({
      totalAssets: 0,
      totalRealEstateValue: 0,
    }));
    expect(c.earnedPoints).toBe(0);
    expect(c.actionUrl).toBe('/app/assets');
  });

  test('2 pts for 41–60% debt ratio', () => {
    const c = scoreDebtLoad(withOverrides({
      totalLiabilities: 400_000,
      totalRealEstateMortgageDebt: 200_000,
      totalAssets: 600_000,
      totalRealEstateValue: 600_000,
    }));
    // 600k / 1200k = 50%
    expect(c.earnedPoints).toBe(2);
  });

  test('0 pts for >60% debt ratio', () => {
    const c = scoreDebtLoad(withOverrides({
      totalLiabilities: 700_000,
      totalRealEstateMortgageDebt: 200_000,
      totalAssets: 600_000,
      totalRealEstateValue: 600_000,
    }));
    // 900k / 1200k = 75%
    expect(c.earnedPoints).toBe(0);
  });
});

// ─── scoreHealthcarePreparedness ─────────────────────────────────────────────

describe('scoreHealthcarePreparedness', () => {
  test('15 pts when healthcare plan exists', () => {
    const c = scoreHealthcarePreparedness(baseInput);
    expect(c.earnedPoints).toBe(15);
    expect(c.actionLabel).toBeNull();
  });

  test('0 pts when no healthcare plan', () => {
    const c = scoreHealthcarePreparedness(withOverrides({ hasHealthcarePlan: false }));
    expect(c.earnedPoints).toBe(0);
    expect(c.actionUrl).toBe('/app/healthcare-planning');
  });

  test('maxPoints is 15', () => {
    expect(COMPONENT_MAX_POINTS.healthcare_preparedness).toBe(15);
  });
});

// ─── scoreLongevityCoverage ───────────────────────────────────────────────────

describe('scoreLongevityCoverage', () => {
  test('10 pts when projected end age ≥ lifeExpectancy and ≥90', () => {
    // currentAge=60, projectionEnd=2055-2026=29yrs → 60+29=89 → below 90
    // Need to push projectionEndYear further
    const c = scoreLongevityCoverage(withOverrides({
      latestSimulation: {
        ...baseInput.latestSimulation!,
        projectionEndYear:  2056,  // 30 yrs from 2026 → age 90
        projectionStartYear: 2026,
      },
      primaryMemberCurrentAge:     60,
      primaryMemberLifeExpectancy: 90,
    }));
    expect(c.earnedPoints).toBe(10);
  });

  test('7 pts when projected end age ≥90 but below lifeExpectancy', () => {
    const c = scoreLongevityCoverage(withOverrides({
      latestSimulation: {
        ...baseInput.latestSimulation!,
        projectionEndYear:  2056,  // age 90
        projectionStartYear: 2026,
      },
      primaryMemberCurrentAge:     60,
      primaryMemberLifeExpectancy: 95,  // plan only covers to 90, not 95
    }));
    expect(c.earnedPoints).toBe(7);
  });

  test('4 pts when projected end age 85–89', () => {
    const c = scoreLongevityCoverage(withOverrides({
      latestSimulation: {
        ...baseInput.latestSimulation!,
        projectionEndYear:  2051,  // 25 yrs → age 85
        projectionStartYear: 2026,
      },
      primaryMemberCurrentAge:     60,
      primaryMemberLifeExpectancy: 90,
    }));
    expect(c.earnedPoints).toBe(4);
  });

  test('0 pts when no simulation', () => {
    const c = scoreLongevityCoverage(withOverrides({ latestSimulation: null }));
    expect(c.earnedPoints).toBe(0);
  });

  test('0 pts when no primaryMemberCurrentAge', () => {
    const c = scoreLongevityCoverage(withOverrides({ primaryMemberCurrentAge: null }));
    expect(c.earnedPoints).toBe(0);
  });
});

// ─── scoreEmergencyBuffer ─────────────────────────────────────────────────────

describe('scoreEmergencyBuffer', () => {
  test('10 pts for ≥12 months of liquid assets', () => {
    // 60k expenses/12 = 5k/mo; 60k liquid = 12 months
    const c = scoreEmergencyBuffer(baseInput);
    expect(c.earnedPoints).toBe(10);
  });

  test('7 pts for 6–11 months', () => {
    // 60k/12=5k/mo; 40k liquid = 8 months
    const c = scoreEmergencyBuffer(withOverrides({ totalLiquidAssets: 40_000 }));
    expect(c.earnedPoints).toBe(7);
  });

  test('4 pts for 3–5 months', () => {
    // 60k/12=5k/mo; 20k liquid = 4 months
    const c = scoreEmergencyBuffer(withOverrides({ totalLiquidAssets: 20_000 }));
    expect(c.earnedPoints).toBe(4);
  });

  test('1 pt for <3 months', () => {
    // 60k/12=5k/mo; 10k liquid = 2 months
    const c = scoreEmergencyBuffer(withOverrides({ totalLiquidAssets: 10_000 }));
    expect(c.earnedPoints).toBe(1);
  });

  test('0 pts when no expense data', () => {
    const c = scoreEmergencyBuffer(withOverrides({ annualRetirementExpenses: 0 }));
    expect(c.earnedPoints).toBe(0);
  });

  test('0 pts when no liquid assets', () => {
    const c = scoreEmergencyBuffer(withOverrides({ totalLiquidAssets: 0 }));
    expect(c.earnedPoints).toBe(0);
  });
});

// ─── scoreProfileCompleteness ─────────────────────────────────────────────────

describe('scoreProfileCompleteness', () => {
  test('5 pts for ≥90% completion', () => {
    const c = scoreProfileCompleteness(baseInput); // profileCompletionPct=90
    expect(c.earnedPoints).toBe(5);
    expect(c.actionLabel).toBeNull();
  });

  test('3 pts for 70–89% completion', () => {
    const c = scoreProfileCompleteness(withOverrides({ profileCompletionPct: 75 }));
    expect(c.earnedPoints).toBe(3);
  });

  test('2 pts for 50–69% completion', () => {
    const c = scoreProfileCompleteness(withOverrides({ profileCompletionPct: 55 }));
    expect(c.earnedPoints).toBe(2);
  });

  test('0 pts for <50% completion', () => {
    const c = scoreProfileCompleteness(withOverrides({ profileCompletionPct: 40 }));
    expect(c.earnedPoints).toBe(0);
    expect(c.actionUrl).toBe('/app/overview');
  });
});

// ─── computeAllComponents ─────────────────────────────────────────────────────

describe('computeAllComponents', () => {
  test('returns 7 components', () => {
    const components = computeAllComponents(baseInput);
    expect(components).toHaveLength(7);
  });

  test('all components have correct keys', () => {
    const components = computeAllComponents(baseInput);
    const keys = components.map(c => c.key);
    expect(keys).toContain('portfolio_sufficiency');
    expect(keys).toContain('income_replacement');
    expect(keys).toContain('debt_load');
    expect(keys).toContain('healthcare_preparedness');
    expect(keys).toContain('longevity_coverage');
    expect(keys).toContain('emergency_buffer');
    expect(keys).toContain('profile_completeness');
  });

  test('max points sum to 100', () => {
    const components = computeAllComponents(baseInput);
    const total = components.reduce((s, c) => s + c.maxPoints, 0);
    expect(total).toBe(100);
  });

  test('all earnedPoints ≤ maxPoints', () => {
    const components = computeAllComponents(baseInput);
    for (const c of components) {
      expect(c.earnedPoints).toBeLessThanOrEqual(c.maxPoints);
      expect(c.earnedPoints).toBeGreaterThanOrEqual(0);
    }
  });

  test('percentage = earnedPoints / maxPoints * 100', () => {
    const components = computeAllComponents(baseInput);
    for (const c of components) {
      const expected = Math.round((c.earnedPoints / c.maxPoints) * 100);
      expect(c.percentage).toBe(expected);
    }
  });

  test('actionLabel is null when earned === max', () => {
    const components = computeAllComponents(baseInput);
    for (const c of components) {
      if (c.earnedPoints === c.maxPoints) {
        expect(c.actionLabel).toBeNull();
        expect(c.actionUrl).toBeNull();
      }
    }
  });

  test('baseline input produces reasonable score', () => {
    const components = computeAllComponents(baseInput);
    const total = components.reduce((s, c) => s + c.earnedPoints, 0);
    // baseInput has full points for most categories; expect ≥60
    expect(total).toBeGreaterThanOrEqual(60);
  });
});

// ─── Component struct integrity ───────────────────────────────────────────────

describe('component struct integrity', () => {
  test('every component has all required fields', () => {
    const components = computeAllComponents(baseInput);
    const requiredFields = [
      'key', 'label', 'description', 'maxPoints', 'earnedPoints',
      'percentage', 'tier', 'explanation',
    ];
    for (const c of components) {
      for (const field of requiredFields) {
        expect(c).toHaveProperty(field);
      }
    }
  });

  test('tier is valid HealthScoreTier', () => {
    const validTiers: HealthScoreTier[] = ['EXCELLENT', 'GOOD', 'FAIR', 'AT_RISK', 'CRITICAL'];
    const components = computeAllComponents(baseInput);
    for (const c of components) {
      expect(validTiers).toContain(c.tier);
    }
  });

  test('explanation is a non-empty string', () => {
    const components = computeAllComponents(baseInput);
    for (const c of components) {
      expect(typeof c.explanation).toBe('string');
      expect(c.explanation.length).toBeGreaterThan(10);
    }
  });
});

// ─── TIER_THRESHOLDS ─────────────────────────────────────────────────────────

describe('TIER_THRESHOLDS', () => {
  test('EXCELLENT threshold is 90', () => expect(TIER_THRESHOLDS.EXCELLENT).toBe(90));
  test('GOOD threshold is 75',      () => expect(TIER_THRESHOLDS.GOOD).toBe(75));
  test('FAIR threshold is 60',      () => expect(TIER_THRESHOLDS.FAIR).toBe(60));
  test('AT_RISK threshold is 40',   () => expect(TIER_THRESHOLDS.AT_RISK).toBe(40));
  test('CRITICAL threshold is 0',   () => expect(TIER_THRESHOLDS.CRITICAL).toBe(0));
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  test('fully empty input still returns 7 components without throwing', () => {
    const empty: ComponentInput = {
      totalAssets:                  0,
      totalLiabilities:             0,
      totalRealEstateValue:         0,
      totalRealEstateMortgageDebt:  0,
      totalLiquidAssets:            0,
      annualRetirementExpenses:     0,
      annualGuaranteedIncome:       0,
      profileCompletionPct:         0,
      latestSimulation:             null,
      hasHealthcarePlan:            false,
      primaryMemberCurrentAge:      null,
      primaryMemberLifeExpectancy:  null,
      simulationYearStart:          2026,
    };
    expect(() => computeAllComponents(empty)).not.toThrow();
    const components = computeAllComponents(empty);
    expect(components).toHaveLength(7);
    // Most should be 0 with no data
    const total = components.reduce((s, c) => s + c.earnedPoints, 0);
    expect(total).toBe(0);
  });

  test('100% guaranteed income replacement still caps at 20 pts', () => {
    const c = scoreIncomeReplacement(withOverrides({
      annualGuaranteedIncome: 120_000,   // 200% of expenses
      annualRetirementExpenses: 60_000,
    }));
    expect(c.earnedPoints).toBe(20);
    expect(c.earnedPoints).toBeLessThanOrEqual(c.maxPoints);
  });

  test('profile at exactly 90% earns full 5 pts', () => {
    const c = scoreProfileCompleteness(withOverrides({ profileCompletionPct: 90 }));
    expect(c.earnedPoints).toBe(5);
  });
});
