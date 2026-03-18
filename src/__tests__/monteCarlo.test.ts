/**
 * Phase 6 — Monte Carlo Simulation Engine Tests
 *
 * Coverage:
 * - Seeded RNG reproducibility
 * - Normal distribution sampling
 * - Return path generation and clamping
 * - Monte Carlo path execution via the deterministic engine
 * - Aggregation: percentiles, success rate, depletion timing
 * - Input validation
 * - Golden cases: strong plan, marginal plan, failing plan
 * - Identical seed + inputs → identical output
 */

import { describe, it, expect } from 'vitest';
import { createSeededRng, sampleNormal, generateReturnPath, generateAllReturnPaths } from '@/server/monteCarlo/randomPathService';
import { percentile, median, aggregatePaths } from '@/server/monteCarlo/monteCarloAggregationService';
import { runMonteCarloPaths } from '@/server/monteCarlo/monteCarloProjectionService';
import { validateMonteCarloInput } from '@/server/monteCarlo/monteCarloInputService';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import { MC_BOUNDS } from '@/server/monteCarlo/types';
import type { SimulationSnapshot } from '@/server/simulation/types';
import type { MonteCarloAssumptions, MonteCarloPathSummary } from '@/server/monteCarlo/types';

// ============================================================
// Test fixtures
// ============================================================

function makeSnapshot(overrides?: {
  balance?: number;
  contribution?: number;
  return?: number;
  essential?: number;
  discretionary?: number;
  healthcare?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
}): SimulationSnapshot {
  const o = overrides ?? {};
  return {
    metadata: {
      engineVersion: '1.0.0',
      snapshotGeneratedAt: '2026-01-01',
      householdId: 'test',
      scenarioLabel: 'Test',
    },
    timeline: { simulationYearStart: 2026, projectionEndYear: 2065 },
    household: {
      householdId: 'test',
      planningMode: 'INDIVIDUAL',
      filingStatus: 'SINGLE',
      stateOfResidence: 'CA',
    },
    members: [
      {
        memberId: 'm1',
        firstName: 'Alex',
        lastName: 'Test',
        dateOfBirth: '1980-01-01',
        currentAge: 46,
        retirementTargetAge: o.retirementAge ?? 65,
        lifeExpectancy: o.lifeExpectancy ?? 85,
        isPrimary: true,
      },
    ],
    incomeSources: [
      {
        id: 'inc1',
        memberId: 'm1',
        type: 'SALARY',
        label: 'Salary',
        annualAmount: 120000,
        growthRate: 0.02,
        taxable: true,
        startYear: null,
        endYear: null,
        isPostRetirementIncome: false,
      },
    ],
    assetAccounts: [
      {
        id: 'a1',
        memberId: 'm1',
        ownerType: 'INDIVIDUAL',
        taxTreatment: 'TAX_DEFERRED',
        accountName: '401k',
        currentBalance: o.balance ?? 800000,
        annualContribution: o.contribution ?? 20000,
        expectedReturnRate: o.return ?? 0.07,
        isRetirementAccount: true,
      },
    ],
    liabilities: [],
    expenseProfile: {
      currentAnnualSpending: 80000,
      retirementEssential: o.essential ?? 50000,
      retirementDiscretionary: o.discretionary ?? 20000,
      healthcareAnnual: o.healthcare ?? 8000,
      housingAnnual: 0,
      inflationRate: 0.03,
    },
    benefitSources: [
      {
        id: 'ss1',
        memberId: 'm1',
        type: 'SOCIAL_SECURITY',
        label: 'SS',
        annualBenefit: 24000,
        claimAge: 67,
        startYear: null,
        colaRate: 0.023,
        taxable: true,
        survivorEligible: false,
      },
    ],
    planningAssumptions: {
      inflationRate: 0.03,
      expectedPortfolioReturn: o.return ?? 0.07,
      assumedEffectiveTaxRate: 0.22,
      longevityTargets: { m1: o.lifeExpectancy ?? 85 },
      retirementAgeOverrides: {},
    },
  };
}

function makeAssumptions(overrides?: Partial<MonteCarloAssumptions>): MonteCarloAssumptions {
  return {
    meanReturn: 0.07,
    volatility: 0.12,
    inflationRate: 0.03,
    taxRate: 0.22,
    seed: 42,
    simulationCount: 200, // small count for test speed
    engineVersion: '1.0.0',
    ...overrides,
  };
}

// ============================================================
// Seeded RNG
// ============================================================

describe('createSeededRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = createSeededRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic — same seed produces same sequence', () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('different seeds produce different sequences', () => {
    const rng1 = createSeededRng(1);
    const rng2 = createSeededRng(2);
    const results1 = Array.from({ length: 10 }, () => rng1());
    const results2 = Array.from({ length: 10 }, () => rng2());
    expect(results1).not.toEqual(results2);
  });
});

// ============================================================
// Normal distribution sampling
// ============================================================

describe('sampleNormal', () => {
  it('approximates mean and std over many samples', () => {
    const rng = createSeededRng(7);
    const n = 5000;
    const samples = Array.from({ length: n }, () => sampleNormal(rng, 0.07, 0.12));
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    expect(mean).toBeCloseTo(0.07, 1); // within 0.1
    expect(std).toBeCloseTo(0.12, 1);
  });
});

// ============================================================
// Return path generation
// ============================================================

describe('generateReturnPath', () => {
  it('returns correct length', () => {
    const rng = createSeededRng(1);
    expect(generateReturnPath(rng, 0.07, 0.12, 40)).toHaveLength(40);
  });

  it('clamps values to [RETURN_FLOOR, RETURN_CAP]', () => {
    // Use extreme volatility to force clamping
    const rng = createSeededRng(99);
    const path = generateReturnPath(rng, 0, 5.0, 1000); // extreme vol
    for (const v of path) {
      expect(v).toBeGreaterThanOrEqual(MC_BOUNDS.RETURN_FLOOR);
      expect(v).toBeLessThanOrEqual(MC_BOUNDS.RETURN_CAP);
    }
  });

  it('is reproducible with same RNG state', () => {
    const path1 = generateReturnPath(createSeededRng(5), 0.07, 0.12, 30);
    const path2 = generateReturnPath(createSeededRng(5), 0.07, 0.12, 30);
    expect(path1).toEqual(path2);
  });
});

describe('generateAllReturnPaths', () => {
  it('generates the correct number of paths', () => {
    const paths = generateAllReturnPaths(42, 100, 0.07, 0.12, 30);
    expect(paths).toHaveLength(100);
    for (const p of paths) expect(p).toHaveLength(30);
  });

  it('is fully reproducible: same seed → identical paths', () => {
    const paths1 = generateAllReturnPaths(42, 50, 0.07, 0.12, 20);
    const paths2 = generateAllReturnPaths(42, 50, 0.07, 0.12, 20);
    expect(paths1).toEqual(paths2);
  });

  it('different seeds produce different paths', () => {
    const paths1 = generateAllReturnPaths(1, 10, 0.07, 0.12, 10);
    const paths2 = generateAllReturnPaths(2, 10, 0.07, 0.12, 10);
    expect(paths1[0]).not.toEqual(paths2[0]);
  });
});

// ============================================================
// Deterministic engine return injection
// ============================================================

describe('runDeterministicProjection with return vector', () => {
  it('accepts an annualReturns override without error', () => {
    const snapshot = makeSnapshot();
    const horizon = snapshot.timeline.projectionEndYear - snapshot.timeline.simulationYearStart + 1;
    const returns = Array.from({ length: horizon }, () => 0.07);
    expect(() => runDeterministicProjection(snapshot, { annualReturns: returns })).not.toThrow();
  });

  it('zero returns produce lower ending balance than 7% returns', () => {
    const snapshot = makeSnapshot();
    const horizon = snapshot.timeline.projectionEndYear - snapshot.timeline.simulationYearStart + 1;
    const zeroReturns = Array.from({ length: horizon }, () => 0);
    const highReturns = Array.from({ length: horizon }, () => 0.07);
    const lowResult = runDeterministicProjection(snapshot, { annualReturns: zeroReturns });
    const highResult = runDeterministicProjection(snapshot, { annualReturns: highReturns });
    expect(highResult.summary.endingBalance).toBeGreaterThan(lowResult.summary.endingBalance);
  });

  it('deterministic mode (no options) is equivalent to constant-return vector', () => {
    // Without override, the engine uses acc.expectedReturnRate (0.07)
    // With a uniform 0.07 vector, results should be identical
    const snapshot = makeSnapshot({ return: 0.07 });
    const horizon = snapshot.timeline.projectionEndYear - snapshot.timeline.simulationYearStart + 1;
    const uniformReturns = Array.from({ length: horizon }, () => 0.07);
    const r1 = runDeterministicProjection(snapshot);
    const r2 = runDeterministicProjection(snapshot, { annualReturns: uniformReturns });
    expect(r1.summary.endingBalance).toBeCloseTo(r2.summary.endingBalance, 0);
  });
});

// ============================================================
// Aggregation
// ============================================================

describe('percentile', () => {
  it('returns correct percentiles on sorted array', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 100)).toBe(10);
    // P50 with 10 elements: idx = round(0.5*9) = round(4.5) = 5 → sorted[5] = 6
    expect(percentile(sorted, 50)).toBe(6);
  });

  it('returns 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });
});

describe('median', () => {
  it('returns correct median', () => {
    expect(median([3, 1, 2])).toBe(2); // [1,2,3] → P50 idx = round(1) = 1 → 2
    // [2,4,6,8]: P50 idx = round(0.5*3) = round(1.5) = 2 → sorted[2] = 6
    expect(median([4, 2, 6, 8])).toBe(6);
    expect(median([])).toBe(0);
  });
});

describe('aggregatePaths', () => {
  function makePaths(count: number, successRate: number, endingAssets: (i: number) => number): MonteCarloPathSummary[] {
    return Array.from({ length: count }, (_, i) => ({
      pathIndex: i,
      success: i < Math.round(count * successRate),
      firstDepletionYear: i < Math.round(count * successRate) ? null : 2040 + (i % 10),
      endingAssets: endingAssets(i),
      endingNetWorth: endingAssets(i),
      totalWithdrawals: 10000,
      totalTaxes: 2000,
      yearlyAssets: [endingAssets(i)],
    }));
  }

  it('computes success probability correctly', () => {
    const paths = makePaths(100, 0.8, i => 100000 * (i + 1));
    const snap = makeSnapshot();
    const agg = aggregatePaths(paths, makeAssumptions(), 2026, 2065, snap.members);
    expect(agg.success.successProbability).toBeCloseTo(0.8, 1);
    expect(agg.success.failureProbability).toBeCloseTo(0.2, 1);
    expect(agg.success.successCount).toBe(80);
    expect(agg.success.failureCount).toBe(20);
    expect(agg.success.totalPaths).toBe(100);
  });

  it('computes ending asset percentiles', () => {
    // Paths with assets 1..100k
    const paths = Array.from({ length: 100 }, (_, i): MonteCarloPathSummary => ({
      pathIndex: i,
      success: true,
      firstDepletionYear: null,
      endingAssets: (i + 1) * 1000,
      endingNetWorth: (i + 1) * 1000,
      totalWithdrawals: 0,
      totalTaxes: 0,
      yearlyAssets: [(i + 1) * 1000],
    }));
    const snap = makeSnapshot();
    const agg = aggregatePaths(paths, makeAssumptions(), 2026, 2065, snap.members);
    // P10 with 100 items: idx = round(0.1*99) = round(9.9) = 10 → value = 11000
    // P50 with 100 items: idx = round(0.5*99) = round(49.5) = 50 → value = 51000
    // P90 with 100 items: idx = round(0.9*99) = round(89.1) = 89 → value = 90000
    expect(agg.endingAssets.p10).toBeGreaterThan(8000);
    expect(agg.endingAssets.p10).toBeLessThan(15000);
    expect(agg.endingAssets.p50).toBeGreaterThan(45000);
    expect(agg.endingAssets.p50).toBeLessThan(60000);
    expect(agg.endingAssets.p90).toBeGreaterThan(85000);
    expect(agg.endingAssets.p90).toBeLessThan(100000);
  });

  it('produces balance bands with correct year count', () => {
    const paths = makePaths(20, 1.0, () => 500000);
    const snap = makeSnapshot();
    const agg = aggregatePaths(paths, makeAssumptions(), 2026, 2065, snap.members);
    expect(agg.balanceBands.years).toHaveLength(2065 - 2026 + 1);
    expect(agg.balanceBands.p50).toHaveLength(2065 - 2026 + 1);
  });

  it('returns zero depletion probability when all paths succeed', () => {
    const paths = makePaths(100, 1.0, () => 1_000_000);
    const snap = makeSnapshot();
    const agg = aggregatePaths(paths, makeAssumptions(), 2026, 2065, snap.members);
    expect(agg.success.depletionBeforeAge85Probability).toBe(0);
    expect(agg.success.medianDepletionYear).toBeNull();
    expect(agg.depletionHistogram).toHaveLength(0);
  });
});

// ============================================================
// Input validation
// ============================================================

describe('validateMonteCarloInput', () => {
  it('accepts valid input', () => {
    const result = validateMonteCarloInput({
      householdId: 'h1',
      scenarioId: 's1',
      simulationCount: 1000,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects count below minimum', () => {
    const result = validateMonteCarloInput({
      householdId: 'h1',
      scenarioId: 's1',
      simulationCount: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/at least/);
  });

  it('rejects count above maximum', () => {
    const result = validateMonteCarloInput({
      householdId: 'h1',
      scenarioId: 's1',
      simulationCount: 99999,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/cannot exceed/);
  });

  it('rejects out-of-range volatility override', () => {
    const result = validateMonteCarloInput({
      householdId: 'h1',
      scenarioId: 's1',
      volatilityOverride: 1.5,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects extreme mean return override', () => {
    const result = validateMonteCarloInput({
      householdId: 'h1',
      scenarioId: 's1',
      meanReturnOverride: 2.0,
    });
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// Full Monte Carlo path execution — golden cases
// ============================================================

describe('runMonteCarloPaths — golden cases', () => {
  const N = 300;

  it('Golden case 1: strong plan (high balance, low expenses) → high success rate', () => {
    const snapshot = makeSnapshot({ balance: 2_000_000, essential: 30000, discretionary: 10000, healthcare: 5000 });
    const assumptions = makeAssumptions({ simulationCount: N, seed: 1 });
    const paths = runMonteCarloPaths(snapshot, assumptions);
    const successRate = paths.filter(p => p.success).length / N;
    expect(successRate).toBeGreaterThan(0.85);
  });

  it('Golden case 2: marginal plan → mixed success outcomes', () => {
    const snapshot = makeSnapshot({ balance: 400000, essential: 55000, discretionary: 25000, healthcare: 10000 });
    const assumptions = makeAssumptions({ simulationCount: N, seed: 2, volatility: 0.15 });
    const paths = runMonteCarloPaths(snapshot, assumptions);
    const successRate = paths.filter(p => p.success).length / N;
    // Should be somewhere in the middle — not all or nothing
    expect(successRate).toBeGreaterThan(0.1);
    expect(successRate).toBeLessThan(0.99);
  });

  it('Golden case 3: clearly failing plan (tiny balance, large expenses) → low success rate', () => {
    const snapshot = makeSnapshot({ balance: 50000, essential: 60000, discretionary: 30000, healthcare: 15000 });
    const assumptions = makeAssumptions({ simulationCount: N, seed: 3 });
    const paths = runMonteCarloPaths(snapshot, assumptions);
    const successRate = paths.filter(p => p.success).length / N;
    expect(successRate).toBeLessThan(0.3);
  });

  it('Golden case 4: later retirement improves success rate', () => {
    const snapshotEarly = makeSnapshot({ balance: 500000, retirementAge: 60 });
    const snapshotLate = makeSnapshot({ balance: 500000, retirementAge: 68 });
    const assumptions = makeAssumptions({ simulationCount: N, seed: 4 });
    const pathsEarly = runMonteCarloPaths(snapshotEarly, assumptions);
    const pathsLate = runMonteCarloPaths(snapshotLate, assumptions);
    const rateEarly = pathsEarly.filter(p => p.success).length / N;
    const rateLate = pathsLate.filter(p => p.success).length / N;
    expect(rateLate).toBeGreaterThanOrEqual(rateEarly);
  });

  it('Golden case 5: identical seed + inputs → identical output', () => {
    const snapshot = makeSnapshot();
    const assumptions = makeAssumptions({ simulationCount: N, seed: 99 });
    const paths1 = runMonteCarloPaths(snapshot, assumptions);
    const paths2 = runMonteCarloPaths(snapshot, assumptions);
    expect(paths1.map(p => p.success)).toEqual(paths2.map(p => p.success));
    expect(paths1.map(p => p.endingAssets)).toEqual(paths2.map(p => p.endingAssets));
    expect(paths1.map(p => p.firstDepletionYear)).toEqual(paths2.map(p => p.firstDepletionYear));
  });

  it('returns correct path count', () => {
    const snapshot = makeSnapshot();
    const assumptions = makeAssumptions({ simulationCount: N });
    const paths = runMonteCarloPaths(snapshot, assumptions);
    expect(paths).toHaveLength(N);
  });

  it('each path has a yearlyAssets array matching the projection horizon', () => {
    const snapshot = makeSnapshot();
    const assumptions = makeAssumptions({ simulationCount: 10, seed: 7 });
    const paths = runMonteCarloPaths(snapshot, assumptions);
    const expectedLen = snapshot.timeline.projectionEndYear - snapshot.timeline.simulationYearStart + 1;
    for (const p of paths) {
      expect(p.yearlyAssets.length).toBeLessThanOrEqual(expectedLen);
      expect(p.yearlyAssets.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// End-to-end aggregation of MC paths
// ============================================================

describe('aggregatePaths on real MC output', () => {
  it('strong plan produces high success probability in aggregation', () => {
    const snapshot = makeSnapshot({ balance: 2_000_000, essential: 30000, discretionary: 10000, healthcare: 5000 });
    const assumptions = makeAssumptions({ simulationCount: 200, seed: 11 });
    const paths = runMonteCarloPaths(snapshot, assumptions);
    const agg = aggregatePaths(
      paths,
      assumptions,
      snapshot.timeline.simulationYearStart,
      snapshot.timeline.projectionEndYear,
      snapshot.members
    );
    expect(agg.success.successProbability).toBeGreaterThan(0.8);
    expect(agg.endingAssets.p50).toBeGreaterThan(0);
    expect(agg.balanceBands.years.length).toBeGreaterThan(0);
    expect(agg.balanceBands.p50.length).toBe(agg.balanceBands.years.length);
  });
});
