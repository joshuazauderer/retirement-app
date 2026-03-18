import { describe, it, expect } from 'vitest';
import { validateOverrides } from '@/server/scenarios/scenarioOverrideService';
import { mergeScenarioOverrides, buildAssumptionDiffs } from '@/server/scenarios/scenarioSnapshotMergeService';
import type { ScenarioOverridePayload } from '@/server/scenarios/types';
import type { SimulationSnapshot } from '@/server/simulation/types';

function makeSnapshot(): SimulationSnapshot {
  return {
    metadata: { engineVersion: '1.0.0', snapshotGeneratedAt: '2026-01-01', householdId: 'test', scenarioLabel: 'Baseline' },
    timeline: { simulationYearStart: 2026, projectionEndYear: 2065 },
    household: { householdId: 'test', planningMode: 'INDIVIDUAL', filingStatus: 'SINGLE', stateOfResidence: 'CA' },
    members: [{ memberId: 'm1', firstName: 'Alex', lastName: 'Test', dateOfBirth: '1980-01-01', currentAge: 46, retirementTargetAge: 65, lifeExpectancy: 85, isPrimary: true }],
    incomeSources: [],
    assetAccounts: [{ id: 'a1', memberId: 'm1', ownerType: 'INDIVIDUAL', taxTreatment: 'TAX_DEFERRED', accountName: '401k', currentBalance: 500000, annualContribution: 20000, expectedReturnRate: 0.07, isRetirementAccount: true }],
    liabilities: [],
    expenseProfile: { currentAnnualSpending: 60000, retirementEssential: 40000, retirementDiscretionary: 20000, healthcareAnnual: 6000, housingAnnual: 0, inflationRate: 0.03 },
    benefitSources: [{ id: 'ss1', memberId: 'm1', type: 'SOCIAL_SECURITY', label: 'SS', annualBenefit: 24000, claimAge: 67, startYear: null, colaRate: 0.023, taxable: true, survivorEligible: false }],
    planningAssumptions: { inflationRate: 0.03, expectedPortfolioReturn: 0.07, assumedEffectiveTaxRate: 0.22, longevityTargets: { m1: 85 }, retirementAgeOverrides: {} },
  };
}

describe('validateOverrides', () => {
  it('accepts valid overrides', () => {
    const result = validateOverrides({ inflationRateOverride: 0.04, additionalAnnualSavings: 5000 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects out-of-bounds inflation', () => {
    const result = validateOverrides({ inflationRateOverride: 0.50 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects unrealistic retirement age', () => {
    const result = validateOverrides({ memberOverrides: [{ memberId: 'm1', retirementAgeOverride: 35 }] });
    expect(result.valid).toBe(false);
  });

  it('rejects negative savings', () => {
    const result = validateOverrides({ additionalAnnualSavings: -1000 });
    expect(result.valid).toBe(false);
  });

  it('accepts empty overrides', () => {
    const result = validateOverrides({});
    expect(result.valid).toBe(true);
  });

  it('warns on aggressive returns', () => {
    const result = validateOverrides({ expectedReturnOverride: 0.18 });
    expect(result.valid).toBe(true); // valid but warns
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('mergeScenarioOverrides', () => {
  it('returns baseline snapshot unchanged when no overrides', () => {
    const base = makeSnapshot();
    const merged = mergeScenarioOverrides(base, null, 's1', 'Baseline');
    expect(merged.planningAssumptions.inflationRate).toBe(0.03);
    expect(merged.members[0].retirementTargetAge).toBe(65);
  });

  it('applies inflation override', () => {
    const base = makeSnapshot();
    const merged = mergeScenarioOverrides(base, { inflationRateOverride: 0.045 }, 's1', 'High Inflation');
    expect(merged.planningAssumptions.inflationRate).toBe(0.045);
    expect(merged.expenseProfile.inflationRate).toBe(0.045);
  });

  it('applies retirement age override', () => {
    const base = makeSnapshot();
    const merged = mergeScenarioOverrides(base, { memberOverrides: [{ memberId: 'm1', retirementAgeOverride: 62 }] }, 's1', 'Early Retirement');
    expect(merged.members[0].retirementTargetAge).toBe(62);
  });

  it('applies discretionary pct change', () => {
    const base = makeSnapshot();
    const merged = mergeScenarioOverrides(base, { retirementDiscretionaryPctChange: -0.10 }, 's1', 'Lower Spending');
    expect(merged.expenseProfile.retirementDiscretionary).toBeCloseTo(18000, 0); // 20000 * 0.9
  });

  it('applies additional savings to first account', () => {
    const base = makeSnapshot();
    const merged = mergeScenarioOverrides(base, { additionalAnnualSavings: 5000 }, 's1', 'More Savings');
    expect(merged.assetAccounts[0].annualContribution).toBe(25000); // 20000 + 5000
  });

  it('does not mutate the original snapshot', () => {
    const base = makeSnapshot();
    mergeScenarioOverrides(base, { inflationRateOverride: 0.05 }, 's1', 'Test');
    expect(base.planningAssumptions.inflationRate).toBe(0.03); // unchanged
  });

  it('applies benefit claim age override', () => {
    const base = makeSnapshot();
    const merged = mergeScenarioOverrides(base, { benefitClaimAgeOverrides: [{ benefitId: 'ss1', claimAgeOverride: 70 }] }, 's1', 'Delay SS');
    expect(merged.benefitSources[0].claimAge).toBe(70);
  });

  it('applies return override to all accounts', () => {
    const base = makeSnapshot();
    const merged = mergeScenarioOverrides(base, { expectedReturnOverride: 0.05 }, 's1', 'Lower Return');
    expect(merged.assetAccounts[0].expectedReturnRate).toBe(0.05);
  });
});

describe('buildAssumptionDiffs', () => {
  it('returns empty array when no overrides', () => {
    const base = makeSnapshot();
    const diffs = buildAssumptionDiffs(base, base, null);
    expect(diffs).toHaveLength(0);
  });

  it('returns diff for inflation override', () => {
    const base = makeSnapshot();
    const effective = mergeScenarioOverrides(base, { inflationRateOverride: 0.045 }, 's1', 'Test');
    const diffs = buildAssumptionDiffs(base, effective, { inflationRateOverride: 0.045 });
    const inflationDiff = diffs.find(d => d.label === 'Inflation Rate');
    expect(inflationDiff).toBeDefined();
    expect(inflationDiff!.changed).toBe(true);
    expect(inflationDiff!.baseline).toBe('3.0%');
    expect(inflationDiff!.scenario).toBe('4.5%');
  });

  it('returns diff for retirement age override', () => {
    const base = makeSnapshot();
    const overrides: ScenarioOverridePayload = { memberOverrides: [{ memberId: 'm1', retirementAgeOverride: 62 }] };
    const effective = mergeScenarioOverrides(base, overrides, 's1', 'Early');
    const diffs = buildAssumptionDiffs(base, effective, overrides);
    expect(diffs.some(d => d.label.includes('Retirement Age'))).toBe(true);
  });
});
