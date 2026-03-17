import { describe, it, expect } from "vitest";
import {
  annualizeAmount,
  getMemberAgeAtYear,
  isMemberAlive,
  isMemberRetired,
} from "@/server/simulation/normalizeInputs";
import { runDeterministicProjection } from "@/server/simulation/runDeterministicProjection";
import type { SimulationSnapshot } from "@/server/simulation/types";

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------
function makeSnapshot(
  overrides: Partial<SimulationSnapshot> = {}
): SimulationSnapshot {
  const base: SimulationSnapshot = {
    metadata: {
      engineVersion: "1.0.0",
      snapshotGeneratedAt: "2026-01-01",
      householdId: "test",
      scenarioLabel: "Test",
    },
    timeline: { simulationYearStart: 2026, projectionEndYear: 2056 },
    household: {
      householdId: "test",
      planningMode: "INDIVIDUAL",
      filingStatus: "SINGLE",
      stateOfResidence: "CA",
    },
    members: [
      {
        memberId: "m1",
        firstName: "Alex",
        lastName: "Test",
        dateOfBirth: "1980-01-01",
        currentAge: 46,
        retirementTargetAge: 65,
        lifeExpectancy: 85,
        isPrimary: true,
      },
    ],
    incomeSources: [],
    assetAccounts: [],
    liabilities: [],
    expenseProfile: {
      currentAnnualSpending: 60000,
      retirementEssential: 48000,
      retirementDiscretionary: 12000,
      healthcareAnnual: 6000,
      housingAnnual: 0,
      inflationRate: 0.03,
    },
    benefitSources: [],
    planningAssumptions: {
      inflationRate: 0.03,
      expectedPortfolioReturn: 0.07,
      assumedEffectiveTaxRate: 0.22,
      longevityTargets: { m1: 85 },
      retirementAgeOverrides: {},
    },
    ...overrides,
  };
  return base;
}

// ---------------------------------------------------------------------------
// normalizeInputs
// ---------------------------------------------------------------------------
describe("annualizeAmount", () => {
  it("annualizes weekly correctly", () => {
    expect(annualizeAmount(1000, "WEEKLY")).toBe(52000);
  });
  it("annualizes monthly correctly", () => {
    expect(annualizeAmount(5000, "MONTHLY")).toBe(60000);
  });
  it("annualizes biweekly correctly", () => {
    expect(annualizeAmount(2000, "BIWEEKLY")).toBe(52000);
  });
  it("annualizes quarterly correctly", () => {
    expect(annualizeAmount(15000, "QUARTERLY")).toBe(60000);
  });
  it("annualizes annually correctly (no change)", () => {
    expect(annualizeAmount(100000, "ANNUALLY")).toBe(100000);
  });
});

describe("getMemberAgeAtYear", () => {
  it("calculates age correctly", () => {
    expect(getMemberAgeAtYear("1980-06-15", 2026)).toBe(46);
    expect(getMemberAgeAtYear("1980-06-15", 2045)).toBe(65);
  });
});

describe("isMemberAlive", () => {
  it("returns true at life expectancy age", () => {
    expect(isMemberAlive("1980-01-01", 2065, 85)).toBe(true); // age 85 = at expectancy, still alive
  });
  it("returns false one year past life expectancy", () => {
    expect(isMemberAlive("1980-01-01", 2066, 85)).toBe(false); // age 86 = deceased
  });
});

describe("isMemberRetired", () => {
  it("returns false one year before retirement age", () => {
    expect(isMemberRetired("1980-01-01", 2044, 65)).toBe(false); // age 64
  });
  it("returns true at retirement age", () => {
    expect(isMemberRetired("1980-01-01", 2045, 65)).toBe(true); // age 65
  });
});

// ---------------------------------------------------------------------------
// Deterministic Projection Engine
// ---------------------------------------------------------------------------
describe("Deterministic Projection Engine", () => {
  it("produces year results for the full timeline", () => {
    const snap = makeSnapshot();
    const result = runDeterministicProjection(snap);
    expect(result.yearByYear.length).toBeGreaterThan(0);
    expect(result.summary.projectionStartYear).toBe(2026);
  });

  it("accumulation-only: no withdrawal needed when income exceeds expenses", () => {
    const snap = makeSnapshot({
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 500000,
          annualContribution: 0,
          expectedReturnRate: 0.07,
          isRetirementAccount: false,
        },
      ],
      incomeSources: [
        {
          id: "inc1",
          memberId: "m1",
          type: "SALARY",
          label: "Salary",
          annualAmount: 150000,
          growthRate: 0,
          taxable: true,
          startYear: null,
          endYear: null,
          isPostRetirementIncome: false,
        },
      ],
    });
    const result = runDeterministicProjection(snap);
    const year1 = result.yearByYear[0];
    // 150k income * (1 - 0.22 tax) = 117k net; expenses ~60k + contributions 0 → no withdrawal
    expect(year1.requiredWithdrawal).toBe(0);
  });

  it("retirement drawdown: assets deplete when expenses exceed income", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2041 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 65,
          lifeExpectancy: 80,
          isPrimary: true,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 200000,
          annualContribution: 0,
          expectedReturnRate: 0.04,
          isRetirementAccount: false,
        },
      ],
      expenseProfile: {
        currentAnnualSpending: 60000,
        retirementEssential: 60000,
        retirementDiscretionary: 0,
        healthcareAnnual: 0,
        housingAnnual: 0,
        inflationRate: 0.03,
      },
      planningAssumptions: {
        inflationRate: 0.03,
        expectedPortfolioReturn: 0.04,
        assumedEffectiveTaxRate: 0,
        longevityTargets: { m1: 80 },
        retirementAgeOverrides: {},
      },
    });
    const result = runDeterministicProjection(snap);
    expect(result.summary.success).toBe(false);
    expect(result.summary.firstDepletionYear).not.toBeNull();
  });

  it("Social Security activates at claim age, not before", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2031 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 65,
          lifeExpectancy: 80,
          isPrimary: true,
        },
      ],
      benefitSources: [
        {
          id: "ss1",
          memberId: "m1",
          type: "SOCIAL_SECURITY",
          label: "Social Security",
          annualBenefit: 24000,
          claimAge: 67,
          startYear: null,
          colaRate: 0.023,
          taxable: true,
          survivorEligible: false,
        },
      ],
    });
    const result = runDeterministicProjection(snap);
    // 2026: member is age 65, claim age 67 — not yet active
    const yr2026 = result.yearByYear.find((y) => y.year === 2026);
    expect(yr2026?.benefitsIncome).toBe(0);
    // 2028: member is age 67 — SS activates
    const yr2028 = result.yearByYear.find((y) => y.year === 2028);
    expect(yr2028?.benefitsIncome).toBeGreaterThan(0);
  });

  it("earned income stops at retirement for work-based sources", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2031 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 66,
          lifeExpectancy: 80,
          isPrimary: true,
        },
      ],
      incomeSources: [
        {
          id: "inc1",
          memberId: "m1",
          type: "SALARY",
          label: "Salary",
          annualAmount: 100000,
          growthRate: 0,
          taxable: true,
          startYear: null,
          endYear: null,
          isPostRetirementIncome: false,
        },
      ],
    });
    const result = runDeterministicProjection(snap);
    // 2026: age 65, retirement target 66 — still working
    const yr2026 = result.yearByYear.find((y) => y.year === 2026);
    expect(yr2026?.earnedIncome).toBeGreaterThan(0);
    // 2027: age 66 — retired, salary stops
    const yr2027 = result.yearByYear.find((y) => y.year === 2027);
    expect(yr2027?.earnedIncome).toBe(0);
  });

  it("retirement account contributions stop at retirement", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2029 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 66,
          lifeExpectancy: 80,
          isPrimary: true,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAX_DEFERRED",
          accountName: "401k",
          currentBalance: 500000,
          annualContribution: 23000,
          expectedReturnRate: 0.07,
          isRetirementAccount: true,
        },
      ],
    });
    const result = runDeterministicProjection(snap);
    const yr2026 = result.yearByYear.find((y) => y.year === 2026);
    expect(yr2026?.contributions).toBe(23000); // pre-retirement
    const yr2027 = result.yearByYear.find((y) => y.year === 2027);
    expect(yr2027?.contributions).toBe(0); // retired
  });

  it("withdrawals draw from taxable accounts before tax-deferred", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2028 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 65,
          lifeExpectancy: 80,
          isPrimary: true,
        },
      ],
      assetAccounts: [
        {
          id: "taxable1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 100000,
          annualContribution: 0,
          expectedReturnRate: 0.04,
          isRetirementAccount: false,
        },
        {
          id: "deferred1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAX_DEFERRED",
          accountName: "401k",
          currentBalance: 400000,
          annualContribution: 0,
          expectedReturnRate: 0.07,
          isRetirementAccount: true,
        },
      ],
      expenseProfile: {
        currentAnnualSpending: 60000,
        retirementEssential: 70000,
        retirementDiscretionary: 0,
        healthcareAnnual: 0,
        housingAnnual: 0,
        inflationRate: 0.03,
      },
      planningAssumptions: {
        inflationRate: 0.03,
        expectedPortfolioReturn: 0.07,
        assumedEffectiveTaxRate: 0,
        longevityTargets: { m1: 80 },
        retirementAgeOverrides: {},
      },
    });
    const result = runDeterministicProjection(snap);
    const yr1 = result.yearByYear[0];
    // Taxable account drawn first
    expect(yr1.withdrawalsByBucket.taxable).toBeGreaterThan(0);
  });

  it("depletion is detected when accounts cannot cover expenses", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2030 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 65,
          lifeExpectancy: 80,
          isPrimary: true,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 10000,
          annualContribution: 0,
          expectedReturnRate: 0.04,
          isRetirementAccount: false,
        },
      ],
      expenseProfile: {
        currentAnnualSpending: 60000,
        retirementEssential: 60000,
        retirementDiscretionary: 0,
        healthcareAnnual: 0,
        housingAnnual: 0,
        inflationRate: 0,
      },
      planningAssumptions: {
        inflationRate: 0,
        expectedPortfolioReturn: 0.04,
        assumedEffectiveTaxRate: 0,
        longevityTargets: { m1: 80 },
        retirementAgeOverrides: {},
      },
    });
    const result = runDeterministicProjection(snap);
    expect(result.summary.success).toBe(false);
    expect(result.summary.firstDepletionYear).toBe(2026);
  });

  it("ending balance formula: pure growth, no cash flows", () => {
    // 100k at 10% return, no contributions, no withdrawals, zero expenses, zero taxes
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2027 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 65,
          lifeExpectancy: 80,
          isPrimary: true,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 100000,
          annualContribution: 0,
          expectedReturnRate: 0.1,
          isRetirementAccount: false,
        },
      ],
      expenseProfile: {
        currentAnnualSpending: 0,
        retirementEssential: 0,
        retirementDiscretionary: 0,
        healthcareAnnual: 0,
        housingAnnual: 0,
        inflationRate: 0,
      },
      planningAssumptions: {
        inflationRate: 0,
        expectedPortfolioReturn: 0.1,
        assumedEffectiveTaxRate: 0,
        longevityTargets: { m1: 80 },
        retirementAgeOverrides: {},
      },
    });
    const result = runDeterministicProjection(snap);
    const yr2026 = result.yearByYear.find((y) => y.year === 2026);
    // endBal = 100000 * (1 + 0.1) = 110000
    expect(yr2026?.endingTotalAssets).toBeCloseTo(110000, 0);
  });

  it("simulation marked successful when assets never deplete", () => {
    // Very well-funded scenario
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2031 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 65,
          lifeExpectancy: 70,
          isPrimary: true,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 10_000_000,
          annualContribution: 0,
          expectedReturnRate: 0.05,
          isRetirementAccount: false,
        },
      ],
      expenseProfile: {
        currentAnnualSpending: 60000,
        retirementEssential: 60000,
        retirementDiscretionary: 0,
        healthcareAnnual: 0,
        housingAnnual: 0,
        inflationRate: 0.03,
      },
      planningAssumptions: {
        inflationRate: 0.03,
        expectedPortfolioReturn: 0.05,
        assumedEffectiveTaxRate: 0,
        longevityTargets: { m1: 70 },
        retirementAgeOverrides: {},
      },
    });
    const result = runDeterministicProjection(snap);
    expect(result.summary.success).toBe(true);
    expect(result.summary.firstDepletionYear).toBeNull();
  });
});
