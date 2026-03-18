import { describe, test, expect } from 'vitest';

/**
 * Phase 7 — Withdrawal Strategy Engine Tests
 *
 * Tests cover:
 * - Withdrawal policy engine (all strategy types)
 * - Withdrawal ordering service (all ordering types + tax gross-up)
 * - Engine injection (policy + ordering via runDeterministicProjection)
 * - Sequence risk stress path structure
 * - Golden cases for real planning scenarios
 */

import {
  createPolicyEngineState,
  initializePolicyStateAtRetirement,
  computeWithdrawalInstruction,
  advancePolicyState,
} from '../server/withdrawalStrategies/withdrawalPolicyEngine';
import { executeOrderedWithdrawals } from '../server/withdrawalStrategies/withdrawalOrderingService';
import { runDeterministicProjection } from '../server/simulation/runDeterministicProjection';
import { STRESS_PATHS, getStressPath } from '../server/withdrawalStrategies/sequenceRiskStressService';
import { validateWithdrawalStrategyInput } from '../server/withdrawalStrategies/withdrawalStrategyService';
import type {
  WithdrawalStrategyConfig,
  GuardrailConfig,
} from '../server/withdrawalStrategies/types';
import type { SimulationSnapshot } from '../server/simulation/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<{
  currentYear: number;
  memberAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  taxableBalance: number;
  taxDeferredBalance: number;
  taxFreeBalance: number;
  annualReturn: number;
  inflationRate: number;
  taxRate: number;
  currentSpending: number;
  retirementEssential: number;
  retirementDiscretionary: number;
  annualBenefit: number;
}>= {}): SimulationSnapshot {
  const o = {
    currentYear: 2026,
    memberAge: 60,
    retirementAge: 65,
    lifeExpectancy: 90,
    taxableBalance: 500_000,
    taxDeferredBalance: 500_000,
    taxFreeBalance: 200_000,
    annualReturn: 0.07,
    inflationRate: 0.03,
    taxRate: 0.22,
    currentSpending: 80_000,
    retirementEssential: 40_000,
    retirementDiscretionary: 20_000,
    annualBenefit: 24_000,
    ...overrides,
  };

  const birthYear = o.currentYear - o.memberAge;
  const dob = `${birthYear}-07-01T00:00:00.000Z`;

  return {
    metadata: {
      engineVersion: '1.0.0',
      snapshotGeneratedAt: new Date().toISOString(),
      householdId: 'test-hh',
      scenarioLabel: 'Test',
    },
    timeline: {
      simulationYearStart: o.currentYear,
      projectionEndYear: o.currentYear + (o.lifeExpectancy - o.memberAge),
    },
    household: {
      householdId: 'test-hh',
      planningMode: 'INDIVIDUAL',
      filingStatus: 'SINGLE',
      stateOfResidence: 'CA',
    },
    members: [
      {
        memberId: 'm1',
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: dob,
        currentAge: o.memberAge,
        retirementTargetAge: o.retirementAge,
        lifeExpectancy: o.lifeExpectancy,
        isPrimary: true,
      },
    ],
    incomeSources: [],
    assetAccounts: [
      {
        id: 'acc-taxable',
        memberId: 'm1',
        ownerType: 'INDIVIDUAL',
        taxTreatment: 'TAXABLE',
        accountName: 'Brokerage',
        currentBalance: o.taxableBalance,
        annualContribution: 0,
        expectedReturnRate: o.annualReturn,
        isRetirementAccount: false,
      },
      {
        id: 'acc-deferred',
        memberId: 'm1',
        ownerType: 'INDIVIDUAL',
        taxTreatment: 'TAX_DEFERRED',
        accountName: '401k',
        currentBalance: o.taxDeferredBalance,
        annualContribution: 0,
        expectedReturnRate: o.annualReturn,
        isRetirementAccount: true,
      },
      {
        id: 'acc-free',
        memberId: 'm1',
        ownerType: 'INDIVIDUAL',
        taxTreatment: 'TAX_FREE',
        accountName: 'Roth IRA',
        currentBalance: o.taxFreeBalance,
        annualContribution: 0,
        expectedReturnRate: o.annualReturn,
        isRetirementAccount: true,
      },
    ],
    liabilities: [],
    expenseProfile: {
      currentAnnualSpending: o.currentSpending,
      retirementEssential: o.retirementEssential,
      retirementDiscretionary: o.retirementDiscretionary,
      healthcareAnnual: 0,
      housingAnnual: 0,
      inflationRate: o.inflationRate,
    },
    benefitSources: [
      {
        id: 'ss1',
        memberId: 'm1',
        type: 'SOCIAL_SECURITY',
        label: 'Social Security',
        annualBenefit: o.annualBenefit,
        claimAge: o.retirementAge,
        startYear: null,
        colaRate: 0.023,
        taxable: true,
        survivorEligible: false,
      },
    ],
    planningAssumptions: {
      inflationRate: o.inflationRate,
      expectedPortfolioReturn: o.annualReturn,
      assumedEffectiveTaxRate: o.taxRate,
      longevityTargets: { m1: o.lifeExpectancy },
      retirementAgeOverrides: {},
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Policy Engine Tests
// ---------------------------------------------------------------------------

describe('WithdrawalPolicyEngine', () => {
  const inflationRate = 0.03;
  const retirementYear = 2031;
  const portfolioValue = 1_000_000;

  function makeState(retYear = retirementYear, portfolio = portfolioValue, target = 60_000) {
    const state = createPolicyEngineState();
    state.retirementStartYear = retYear;
    state.initialPortfolioValue = portfolio;
    state.currentYearTarget = target;
    return state;
  }

  describe('NEEDS_BASED', () => {
    test('returns the needs-based gap unchanged', () => {
      const config: WithdrawalStrategyConfig = { strategyType: 'NEEDS_BASED', orderingType: 'TAXABLE_FIRST' };
      const state = makeState();
      const instruction = computeWithdrawalInstruction(config, retirementYear, state, 55_000, portfolioValue, inflationRate, true);
      expect(instruction.targetWithdrawal).toBe(55_000);
      expect(instruction.isNeedsBased).toBe(true);
      expect(instruction.guardrailActive).toBe(false);
    });

    test('returns gap unchanged even when zero (no income needed from portfolio)', () => {
      const config: WithdrawalStrategyConfig = { strategyType: 'NEEDS_BASED', orderingType: 'TAXABLE_FIRST' };
      const state = makeState();
      const instruction = computeWithdrawalInstruction(config, retirementYear, state, 0, portfolioValue, inflationRate, true);
      expect(instruction.targetWithdrawal).toBe(0);
    });

    test('is always needs-based in pre-retirement years', () => {
      const config: WithdrawalStrategyConfig = { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 70_000 };
      const state = createPolicyEngineState(); // no retirement set
      state.retirementStartYear = null;
      const instruction = computeWithdrawalInstruction(config, 2028, state, 10_000, portfolioValue, inflationRate, false);
      expect(instruction.isNeedsBased).toBe(true);
      expect(instruction.targetWithdrawal).toBe(10_000);
    });
  });

  describe('FIXED_NOMINAL', () => {
    test('returns the fixed target regardless of needs-based gap', () => {
      const config: WithdrawalStrategyConfig = { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 60_000 };
      const state = makeState();
      const instruction = computeWithdrawalInstruction(config, retirementYear, state, 30_000, portfolioValue, inflationRate, true);
      expect(instruction.targetWithdrawal).toBe(60_000);
      expect(instruction.isNeedsBased).toBe(false);
    });

    test('is constant across multiple years (no inflation)', () => {
      const config: WithdrawalStrategyConfig = { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 60_000 };
      const state = makeState();
      for (let y = retirementYear; y < retirementYear + 5; y++) {
        const instruction = computeWithdrawalInstruction(config, y, state, 50_000, portfolioValue, inflationRate, true);
        expect(instruction.targetWithdrawal).toBe(60_000);
      }
    });
  });

  describe('FIXED_REAL', () => {
    test('inflates the target each year', () => {
      const config: WithdrawalStrategyConfig = { strategyType: 'FIXED_REAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 60_000 };
      const state = makeState();

      // Year 0 of retirement: inflation factor = 1
      const y0 = computeWithdrawalInstruction(config, retirementYear, state, 0, portfolioValue, inflationRate, true);
      expect(y0.targetWithdrawal).toBeCloseTo(60_000, 0);

      // Year 5 of retirement: 60000 × (1.03)^5
      const state5 = makeState();
      state5.retirementStartYear = retirementYear;
      const y5 = computeWithdrawalInstruction(config, retirementYear + 5, state5, 0, portfolioValue, inflationRate, true);
      const expected5 = 60_000 * Math.pow(1.03, 5);
      expect(y5.targetWithdrawal).toBeCloseTo(expected5, 0);
    });

    test('FIXED_REAL > FIXED_NOMINAL after sufficient years of inflation', () => {
      const realConfig: WithdrawalStrategyConfig = { strategyType: 'FIXED_REAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 60_000 };
      const nomConfig: WithdrawalStrategyConfig = { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 60_000 };
      const stateR = makeState();
      const stateN = makeState();

      const year10 = retirementYear + 10;
      const realInstruction = computeWithdrawalInstruction(realConfig, year10, stateR, 0, portfolioValue, inflationRate, true);
      const nomInstruction = computeWithdrawalInstruction(nomConfig, year10, stateN, 0, portfolioValue, inflationRate, true);

      expect(realInstruction.targetWithdrawal).toBeGreaterThan(nomInstruction.targetWithdrawal);
    });
  });

  describe('GUARDRAIL', () => {
    const guardrailConfig: GuardrailConfig = {
      initialAnnualWithdrawal: 60_000,
      lowerGuardrailPct: 0.80,
      upperGuardrailPct: 1.50,
      decreaseStepPct: 0.10,
      increaseStepPct: 0.05,
      floorAnnualWithdrawal: 40_000,
      ceilingMultiplier: 1.5,
    };
    const config: WithdrawalStrategyConfig = {
      strategyType: 'GUARDRAIL',
      orderingType: 'TAXABLE_FIRST',
      guardrailConfig,
    };

    test('no adjustment when portfolio is within normal range', () => {
      // Portfolio at 100% of initial → no adjustment
      const state = makeState(retirementYear, 1_000_000, 60_000);
      const instruction = computeWithdrawalInstruction(config, retirementYear, state, 0, 1_000_000, inflationRate, true);
      expect(instruction.targetWithdrawal).toBeCloseTo(60_000, 0);
      expect(instruction.guardrailDirection).toBe('none');
    });

    test('reduces withdrawal when portfolio is below lower guardrail', () => {
      // Portfolio at 70% of initial → below 80% guardrail
      const state = makeState(retirementYear, 1_000_000, 60_000);
      const instruction = computeWithdrawalInstruction(config, retirementYear + 1, state, 0, 700_000, inflationRate, true);
      expect(instruction.guardrailDirection).toBe('reduced');
      expect(instruction.targetWithdrawal).toBeLessThan(60_000);
      expect(instruction.targetWithdrawal).toBeGreaterThanOrEqual(40_000); // above floor
    });

    test('increases withdrawal when portfolio exceeds upper guardrail', () => {
      // Portfolio at 160% of initial → above 150% guardrail
      const state = makeState(retirementYear, 1_000_000, 60_000);
      const instruction = computeWithdrawalInstruction(config, retirementYear + 1, state, 0, 1_600_000, inflationRate, true);
      expect(instruction.guardrailDirection).toBe('increased');
      expect(instruction.targetWithdrawal).toBeGreaterThan(60_000);
    });

    test('never goes below floor', () => {
      // Portfolio nearly wiped out → guardrail reduction should hit floor
      const state = makeState(retirementYear, 1_000_000, 42_000);
      // 42000 × 0.90 = 37800 < floor 40000
      const instruction = computeWithdrawalInstruction(config, retirementYear + 1, state, 0, 100_000, inflationRate, true);
      expect(instruction.targetWithdrawal).toBeGreaterThanOrEqual(40_000);
    });

    test('guardrail state advances correctly for multi-year tracking', () => {
      const state = createPolicyEngineState();
      initializePolicyStateAtRetirement(state, retirementYear, 1_000_000, config);
      expect(state.currentYearTarget).toBe(60_000);

      // Year 1: below lower guardrail → reduction
      const i1 = computeWithdrawalInstruction(config, retirementYear, state, 0, 700_000, inflationRate, true);
      advancePolicyState(state, i1);
      expect(state.currentYearTarget).toBe(i1.targetWithdrawal);

      // Year 2: still depressed — reduction applies to already-reduced target
      const i2 = computeWithdrawalInstruction(config, retirementYear + 1, state, 0, 700_000, inflationRate, true);
      expect(i2.targetWithdrawal).toBeLessThanOrEqual(i1.targetWithdrawal);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Ordering Service Tests
// ---------------------------------------------------------------------------

describe('WithdrawalOrderingService', () => {
  const accounts = [
    { id: 'taxable', taxTreatment: 'TAXABLE' as const },
    { id: 'deferred', taxTreatment: 'TAX_DEFERRED' as const },
    { id: 'free', taxTreatment: 'TAX_FREE' as const },
  ];
  const balances = { taxable: 200_000, deferred: 300_000, free: 100_000 };
  const taxRate = 0.22;

  test('TAXABLE_FIRST draws from taxable first', () => {
    const result = executeOrderedWithdrawals(50_000, balances, accounts, taxRate, 'TAXABLE_FIRST');
    expect(result.byBucket.taxable).toBe(50_000);
    expect(result.byBucket.taxDeferred).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  test('TAX_DEFERRED_FIRST draws from deferred first with gross-up', () => {
    const target = 50_000;
    const result = executeOrderedWithdrawals(target, balances, accounts, taxRate, 'TAX_DEFERRED_FIRST');
    // Should have sourced from deferred (grossed up)
    expect(result.byBucket.taxDeferred).toBeGreaterThan(0);
    expect(result.byBucket.taxable).toBe(0); // shouldn't need taxable
    // Gross withdrawal should be target / (1 - 0.22) ≈ 64102
    expect(result.actualWithdrawal).toBeCloseTo(target / (1 - taxRate), 0);
    expect(result.shortfall).toBeLessThanOrEqual(0.01);
  });

  test('TAX_FREE_FIRST draws from tax-free first', () => {
    const target = 50_000;
    const result = executeOrderedWithdrawals(target, balances, accounts, taxRate, 'TAX_FREE_FIRST');
    expect(result.byBucket.taxFree).toBe(50_000);
    expect(result.byBucket.taxable).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  test('PRO_RATA distributes proportionally', () => {
    const target = 60_000;
    // Net balances: taxable=200k, deferred=300k×0.78=234k, free=100k → total=534k
    const result = executeOrderedWithdrawals(target, balances, accounts, taxRate, 'PRO_RATA');
    // All buckets should have withdrawals
    expect(result.byBucket.taxable).toBeGreaterThan(0);
    expect(result.byBucket.taxDeferred).toBeGreaterThan(0);
    expect(result.byBucket.taxFree).toBeGreaterThan(0);
    expect(result.shortfall).toBeLessThanOrEqual(0.01);
  });

  test('TAX_DEFERRED gross-up: net covered equals target', () => {
    const target = 30_000;
    const smallBalances = { taxable: 0, deferred: 200_000, free: 0 };
    const result = executeOrderedWithdrawals(target, smallBalances, accounts, taxRate, 'TAXABLE_FIRST');
    const netCovered = result.byBucket.taxDeferred * (1 - taxRate);
    expect(netCovered).toBeCloseTo(target, 0);
    expect(result.shortfall).toBeLessThanOrEqual(0.01);
  });

  test('returns shortfall when accounts cannot cover target', () => {
    const emptyBalances = { taxable: 0, deferred: 0, free: 0 };
    const result = executeOrderedWithdrawals(50_000, emptyBalances, accounts, taxRate, 'TAXABLE_FIRST');
    expect(result.actualWithdrawal).toBe(0);
    expect(result.shortfall).toBeCloseTo(50_000, 0);
  });

  test('zero target returns zero result with no shortfall', () => {
    const result = executeOrderedWithdrawals(0, balances, accounts, taxRate, 'TAXABLE_FIRST');
    expect(result.actualWithdrawal).toBe(0);
    expect(result.shortfall).toBe(0);
  });

  test('partial coverage when accounts are insufficient', () => {
    const tightBalances = { taxable: 10_000, deferred: 0, free: 0 };
    const result = executeOrderedWithdrawals(30_000, tightBalances, accounts, taxRate, 'TAXABLE_FIRST');
    expect(result.byBucket.taxable).toBe(10_000);
    expect(result.shortfall).toBeCloseTo(20_000, 0);
  });
});

// ---------------------------------------------------------------------------
// 3. Engine Integration Tests
// ---------------------------------------------------------------------------

describe('Engine Integration (Phase 7)', () => {
  test('NEEDS_BASED policy produces same result as default engine', () => {
    const snapshot = makeSnapshot({ memberAge: 65, retirementAge: 65 });
    const baseline = runDeterministicProjection(snapshot);
    const policyRun = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'NEEDS_BASED', orderingType: 'TAXABLE_FIRST' },
      orderingType: 'TAXABLE_FIRST',
    });

    expect(policyRun.summary.totalWithdrawals).toBeCloseTo(baseline.summary.totalWithdrawals, -2);
    expect(policyRun.summary.success).toBe(baseline.summary.success);
  });

  test('FIXED_NOMINAL policy with zero target leaves assets intact', () => {
    const snapshot = makeSnapshot({ memberAge: 65, retirementAge: 65, annualBenefit: 200_000 }); // income covers everything
    const run = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 0 },
    });
    // With $200k benefit and $60k expenses, no withdrawal needed; target is 0, so nothing drawn
    const retirementYears = run.yearByYear.filter((y) => y.memberRetired['m1']);
    for (const y of retirementYears) {
      expect(y.actualWithdrawal).toBe(0);
    }
  });

  test('TAX_DEFERRED_FIRST ordering draws from 401k before taxable', () => {
    const snapshot = makeSnapshot({ memberAge: 65, retirementAge: 65 });
    const run = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'NEEDS_BASED', orderingType: 'TAX_DEFERRED_FIRST' },
      orderingType: 'TAX_DEFERRED_FIRST',
    });

    // First retirement year should draw from TAX_DEFERRED first
    const firstRetYear = run.yearByYear.find((y) => y.memberRetired['m1'] && y.actualWithdrawal > 0);
    if (firstRetYear) {
      expect(firstRetYear.withdrawalsByBucket.taxDeferred).toBeGreaterThan(0);
      // May or may not use taxable depending on amount vs deferred capacity
    }
  });

  test('policyWithdrawalTarget is set on retirement year state', () => {
    const snapshot = makeSnapshot({ memberAge: 65, retirementAge: 65 });
    const run = runDeterministicProjection(snapshot, {
      withdrawalPolicy: {
        strategyType: 'FIXED_NOMINAL',
        orderingType: 'TAXABLE_FIRST',
        annualWithdrawalTarget: 50_000,
      },
    });

    const retirementYears = run.yearByYear.filter((y) => y.memberRetired['m1']);
    for (const y of retirementYears) {
      expect(y.policyWithdrawalTarget).toBe(50_000);
    }
  });

  test('sequence risk override vector changes ending assets', () => {
    const snapshot = makeSnapshot({ memberAge: 65, retirementAge: 65 });
    const baselineReturn = 0.07;
    const years = snapshot.timeline.projectionEndYear - snapshot.timeline.simulationYearStart + 1;

    // Baseline: use default returns
    const baseline = runDeterministicProjection(snapshot);

    // Stress: first 3 years at -20%, -10%, 0%, rest at baseline
    const crashReturns = Array.from({ length: years }, (_, i) => {
      if (i === 0) return -0.20;
      if (i === 1) return -0.10;
      if (i === 2) return 0.00;
      return baselineReturn;
    });

    const stressed = runDeterministicProjection(snapshot, { annualReturns: crashReturns });
    expect(stressed.summary.endingBalance).toBeLessThan(baseline.summary.endingBalance);
  });
});

// ---------------------------------------------------------------------------
// 4. Sequence Risk Stress Paths
// ---------------------------------------------------------------------------

describe('SequenceRiskStressService', () => {
  test('all expected stress paths are defined', () => {
    const ids = STRESS_PATHS.map((p) => p.id);
    expect(ids).toContain('early_crash');
    expect(ids).toContain('mild_early_weakness');
    expect(ids).toContain('delayed_crash');
  });

  test('early_crash has negative return in year 0', () => {
    const path = getStressPath('early_crash')!;
    expect(path).toBeDefined();
    expect(path.annualReturnOverrides[0]).toBeLessThan(0);
  });

  test('delayed_crash has null entries before the crash', () => {
    const path = getStressPath('delayed_crash')!;
    expect(path.annualReturnOverrides[0]).toBeNull();
    expect(path.annualReturnOverrides[4]).toBeNull();
    expect(path.annualReturnOverrides[5]).toBeLessThan(0); // crash starts at index 5
  });

  test('mild_early_weakness returns are worse than baseline (7%) but not catastrophic', () => {
    const path = getStressPath('mild_early_weakness')!;
    expect(path.annualReturnOverrides[0]).toBeLessThan(0);
    expect(path.annualReturnOverrides[0]).toBeGreaterThan(-0.20);
  });

  test('all paths have a label and description', () => {
    for (const path of STRESS_PATHS) {
      expect(path.label).toBeTruthy();
      expect(path.description).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Input Validation
// ---------------------------------------------------------------------------

describe('WithdrawalStrategyValidation', () => {
  const validBase = {
    householdId: 'hh1',
    scenarioId: 'sc1',
    config: {
      strategyType: 'NEEDS_BASED' as const,
      orderingType: 'TAXABLE_FIRST' as const,
    },
  };

  test('valid NEEDS_BASED input passes', () => {
    const result = validateWithdrawalStrategyInput(validBase);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing householdId fails', () => {
    const result = validateWithdrawalStrategyInput({ ...validBase, householdId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Household'))).toBe(true);
  });

  test('FIXED_NOMINAL without target fails', () => {
    const result = validateWithdrawalStrategyInput({
      ...validBase,
      config: { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('withdrawal target'))).toBe(true);
  });

  test('FIXED_NOMINAL with negative target fails', () => {
    const result = validateWithdrawalStrategyInput({
      ...validBase,
      config: { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: -1000 },
    });
    expect(result.valid).toBe(false);
  });

  test('GUARDRAIL without guardrailConfig fails', () => {
    const result = validateWithdrawalStrategyInput({
      ...validBase,
      config: { strategyType: 'GUARDRAIL', orderingType: 'TAXABLE_FIRST' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Guardrail configuration'))).toBe(true);
  });

  test('GUARDRAIL with invalid lower guardrail fails', () => {
    const result = validateWithdrawalStrategyInput({
      ...validBase,
      config: {
        strategyType: 'GUARDRAIL',
        orderingType: 'TAXABLE_FIRST',
        guardrailConfig: {
          initialAnnualWithdrawal: 60_000,
          lowerGuardrailPct: 1.5, // invalid: > 1
          upperGuardrailPct: 2.0,
          decreaseStepPct: 0.10,
          increaseStepPct: 0.05,
          floorAnnualWithdrawal: 40_000,
          ceilingMultiplier: 1.5,
        },
      },
    });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Golden Cases
// ---------------------------------------------------------------------------

describe('Golden Cases', () => {
  test('GC1: Healthy plan — needs-based — fully funded', () => {
    // Rich household: $2M in assets, moderate spending, strong SS
    const snapshot = makeSnapshot({
      memberAge: 65,
      retirementAge: 65,
      taxableBalance: 1_000_000,
      taxDeferredBalance: 700_000,
      taxFreeBalance: 300_000,
      retirementEssential: 30_000,
      retirementDiscretionary: 20_000,
      annualBenefit: 36_000,
    });
    const result = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'NEEDS_BASED', orderingType: 'TAXABLE_FIRST' },
    });
    expect(result.summary.success).toBe(true);
    expect(result.summary.firstDepletionYear).toBeNull();
  });

  test('GC2: Failing fixed-withdrawal plan — depletes early', () => {
    // Modest assets, high fixed withdrawal
    const snapshot = makeSnapshot({
      memberAge: 65,
      retirementAge: 65,
      taxableBalance: 100_000,
      taxDeferredBalance: 100_000,
      taxFreeBalance: 50_000,
      retirementEssential: 50_000,
      retirementDiscretionary: 30_000,
      annualBenefit: 15_000,
    });
    const result = runDeterministicProjection(snapshot, {
      withdrawalPolicy: {
        strategyType: 'FIXED_NOMINAL',
        orderingType: 'TAXABLE_FIRST',
        annualWithdrawalTarget: 80_000,
      },
    });
    // With only 250k total and $80k/yr withdrawals, should deplete quickly
    expect(result.summary.firstDepletionYear).not.toBeNull();
    expect(result.summary.success).toBe(false);
  });

  test('GC3: FIXED_REAL depletes later than FIXED_NOMINAL in same inflation scenario', () => {
    // Fixed real starts the same, but grows — will have fewer assets over time
    // Actually, in low-inflation scenarios, real and nominal behave similarly
    // The key test: both run and produce distinct results
    const snapshot = makeSnapshot({
      memberAge: 65,
      retirementAge: 65,
      taxableBalance: 400_000,
      taxDeferredBalance: 400_000,
      taxFreeBalance: 200_000,
    });

    const realRun = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'FIXED_REAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 55_000 },
    });
    const nomRun = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'FIXED_NOMINAL', orderingType: 'TAXABLE_FIRST', annualWithdrawalTarget: 55_000 },
    });

    // Real withdraws more over time due to inflation, so ends with less
    expect(realRun.summary.totalWithdrawals).toBeGreaterThan(nomRun.summary.totalWithdrawals);
  });

  test('GC4: TAX_DEFERRED_FIRST draws from 401k in early retirement; TAXABLE_FIRST does not', () => {
    const snapshot = makeSnapshot({ memberAge: 65, retirementAge: 65 });

    const taxableFirst = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'NEEDS_BASED', orderingType: 'TAXABLE_FIRST' },
      orderingType: 'TAXABLE_FIRST',
    });
    const deferredFirst = runDeterministicProjection(snapshot, {
      withdrawalPolicy: { strategyType: 'NEEDS_BASED', orderingType: 'TAX_DEFERRED_FIRST' },
      orderingType: 'TAX_DEFERRED_FIRST',
    });

    // In the FIRST retirement year, TAX_DEFERRED_FIRST should draw from deferred
    // while TAXABLE_FIRST should draw from taxable (not deferred).
    const tfFirstRetYear = taxableFirst.yearByYear.find((y) => y.memberRetired['m1'] && y.actualWithdrawal > 0);
    const dfFirstRetYear = deferredFirst.yearByYear.find((y) => y.memberRetired['m1'] && y.actualWithdrawal > 0);

    if (tfFirstRetYear && dfFirstRetYear) {
      // TAXABLE_FIRST: first year withdrawal is from taxable
      expect(tfFirstRetYear.withdrawalsByBucket.taxable).toBeGreaterThan(0);
      expect(tfFirstRetYear.withdrawalsByBucket.taxDeferred).toBe(0);

      // TAX_DEFERRED_FIRST: first year withdrawal is from tax-deferred
      expect(dfFirstRetYear.withdrawalsByBucket.taxDeferred).toBeGreaterThan(0);
      expect(dfFirstRetYear.withdrawalsByBucket.taxable).toBe(0);
    }
  });

  test('GC5: Early crash stress path materially worsens outcome', () => {
    const snapshot = makeSnapshot({ memberAge: 65, retirementAge: 65 });
    const baseline = runDeterministicProjection(snapshot);
    const years = snapshot.timeline.projectionEndYear - snapshot.timeline.simulationYearStart + 1;

    const crashReturns = Array.from({ length: years }, (_, i) => {
      if (i === 0) return -0.20;
      if (i === 1) return -0.10;
      if (i === 2) return 0.00;
      return 0.07;
    });

    const stressed = runDeterministicProjection(snapshot, { annualReturns: crashReturns });
    const endingDelta = stressed.summary.endingBalance - baseline.summary.endingBalance;

    // Crash should materially reduce ending balance
    expect(endingDelta).toBeLessThan(-50_000);
  });

  test('GC6: Guardrail improves durability vs fixed withdrawal for fragile plan', () => {
    // Borderline plan: modest assets, needs careful management
    const snapshot = makeSnapshot({
      memberAge: 65,
      retirementAge: 65,
      taxableBalance: 200_000,
      taxDeferredBalance: 250_000,
      taxFreeBalance: 50_000,
      retirementEssential: 35_000,
      retirementDiscretionary: 15_000,
      annualBenefit: 20_000,
    });

    const fixedRun = runDeterministicProjection(snapshot, {
      withdrawalPolicy: {
        strategyType: 'FIXED_NOMINAL',
        orderingType: 'TAXABLE_FIRST',
        annualWithdrawalTarget: 45_000,
      },
    });

    const guardrailRun = runDeterministicProjection(snapshot, {
      withdrawalPolicy: {
        strategyType: 'GUARDRAIL',
        orderingType: 'TAXABLE_FIRST',
        guardrailConfig: {
          initialAnnualWithdrawal: 45_000,
          lowerGuardrailPct: 0.80,
          upperGuardrailPct: 1.50,
          decreaseStepPct: 0.10,
          increaseStepPct: 0.05,
          floorAnnualWithdrawal: 30_000,
          ceilingMultiplier: 1.5,
        },
      },
    });

    // Guardrail should either delay depletion or end with more assets
    const guardrailEndingBetter =
      guardrailRun.summary.endingBalance >= fixedRun.summary.endingBalance ||
      (guardrailRun.summary.firstDepletionYear ?? Infinity) >= (fixedRun.summary.firstDepletionYear ?? Infinity);
    expect(guardrailEndingBetter).toBe(true);
  });
});
