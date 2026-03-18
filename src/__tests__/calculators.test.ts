import { describe, it, expect } from "vitest";
import type { SimulationSnapshot } from "@/server/simulation/types";
import { computeRetirementReadiness } from "@/server/calculators/retirementReadinessService";
import { computeSavingsGap } from "@/server/calculators/savingsGapService";
import { computeWithdrawalCalculator } from "@/server/calculators/withdrawalCalculatorService";
import { computeYearsUntilRetirement } from "@/server/calculators/yearsUntilRetirementService";
import { computeRetirementIncomeProjection } from "@/server/calculators/retirementIncomeProjectionService";

// ---------------------------------------------------------------------------
// Test helper — mirrors the pattern in simulation.test.ts
// ---------------------------------------------------------------------------
function makeSnapshot(overrides: Partial<SimulationSnapshot> = {}): SimulationSnapshot {
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

// Healthy plan: large assets, retires already, short horizon
function makeHealthySnap(): SimulationSnapshot {
  return makeSnapshot({
    timeline: { simulationYearStart: 2026, projectionEndYear: 2036 },
    members: [
      {
        memberId: "m1",
        firstName: "Alex",
        lastName: "Test",
        dateOfBirth: "1961-01-01",
        currentAge: 65,
        retirementTargetAge: 65,
        lifeExpectancy: 75,
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
      longevityTargets: { m1: 75 },
      retirementAgeOverrides: {},
    },
  });
}

// Failing plan: tiny assets, already retired
function makeFailingSnap(): SimulationSnapshot {
  return makeSnapshot({
    timeline: { simulationYearStart: 2026, projectionEndYear: 2036 },
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
        currentBalance: 50_000,
        annualContribution: 0,
        expectedReturnRate: 0.04,
        isRetirementAccount: false,
      },
    ],
    expenseProfile: {
      currentAnnualSpending: 60000,
      retirementEssential: 60000,
      retirementDiscretionary: 10000,
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
}

// ---------------------------------------------------------------------------
// Retirement Readiness
// ---------------------------------------------------------------------------
describe("computeRetirementReadiness", () => {
  it("healthy plan → Strong status and no depletion", () => {
    const snap = makeHealthySnap();
    const result = computeRetirementReadiness(snap);
    expect(result.status).toBe("Strong");
    expect(result.success).toBe(true);
    expect(result.firstDepletionYear).toBeNull();
  });

  it("failing plan → At Risk status with depletion year", () => {
    const snap = makeFailingSnap();
    const result = computeRetirementReadiness(snap);
    expect(result.status).toBe("At Risk");
    expect(result.success).toBe(false);
    expect(result.firstDepletionYear).not.toBeNull();
  });

  it("returns yearsFullyFunded equal to yearsProjected for healthy plan", () => {
    const snap = makeHealthySnap();
    const result = computeRetirementReadiness(snap);
    expect(result.yearsFullyFunded).toBe(result.yearsProjected);
  });

  it("summary fields are populated", () => {
    const snap = makeHealthySnap();
    const result = computeRetirementReadiness(snap);
    expect(result.projectionStartYear).toBe(2026);
    expect(result.endingBalance).toBeGreaterThan(0);
    expect(result.summary).toBeDefined();
    expect(result.summary.householdId).toBe("test");
  });
});

// ---------------------------------------------------------------------------
// Savings Gap
// ---------------------------------------------------------------------------
describe("computeSavingsGap", () => {
  it("healthy plan → baselineSuccess true, zero gap", () => {
    const snap = makeHealthySnap();
    const result = computeSavingsGap(snap);
    expect(result.baselineSuccess).toBe(true);
    expect(result.additionalAnnualSavingsNeeded).toBe(0);
    expect(result.retirementSpendingReductionNeeded).toBe(0);
    expect(result.firstDepletionYear).toBeNull();
  });

  it("failing plan → positive savings gap or bound reached", () => {
    const snap = makeFailingSnap();
    const result = computeSavingsGap(snap);
    expect(result.baselineSuccess).toBe(false);
    expect(result.firstDepletionYear).not.toBeNull();
    // Either found a gap amount or reached search bound
    const hasGap =
      result.additionalAnnualSavingsNeeded !== null ||
      result.retirementSpendingReductionNeeded !== null ||
      result.searchBoundReached;
    expect(hasGap).toBe(true);
  });

  it("failing plan: monthly savings is annual / 12 (rounded up)", () => {
    const snap = makeFailingSnap();
    const result = computeSavingsGap(snap);
    if (result.additionalAnnualSavingsNeeded !== null && result.additionalMonthlySavingsNeeded !== null) {
      expect(result.additionalMonthlySavingsNeeded).toBe(
        Math.ceil(result.additionalAnnualSavingsNeeded / 12)
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Withdrawal Calculator
// ---------------------------------------------------------------------------
describe("computeWithdrawalCalculator", () => {
  it("healthy plan: does not deplete", () => {
    const snap = makeHealthySnap();
    const result = computeWithdrawalCalculator(snap);
    expect(result.currentPlanDepletes).toBe(false);
    expect(result.currentPlanFirstDepletionYear).toBeNull();
  });

  it("failing plan: depletes, sustainable withdrawal < planned", () => {
    const snap = makeFailingSnap();
    const result = computeWithdrawalCalculator(snap);
    expect(result.currentPlanDepletes).toBe(true);
    expect(result.currentPlanFirstDepletionYear).not.toBeNull();
    // Sustainable amount should be less than planned (or null/bound)
    if (result.sustainableAnnualWithdrawal !== null && !result.searchBoundReached) {
      expect(result.sustainableAnnualWithdrawal).toBeLessThanOrEqual(result.plannedAnnualWithdrawal);
    }
  });

  it("sustainable monthly withdrawal is floor of annual / 12", () => {
    const snap = makeHealthySnap();
    const result = computeWithdrawalCalculator(snap);
    if (result.sustainableAnnualWithdrawal !== null && result.sustainableMonthlyWithdrawal !== null) {
      expect(result.sustainableMonthlyWithdrawal).toBe(
        Math.floor(result.sustainableAnnualWithdrawal / 12)
      );
    }
  });

  it("note field is always present", () => {
    const snap = makeHealthySnap();
    const result = computeWithdrawalCalculator(snap);
    expect(typeof result.note).toBe("string");
    expect(result.note.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Years Until Retirement
// ---------------------------------------------------------------------------
describe("computeYearsUntilRetirement", () => {
  it("born 1980, retire at 65, year 2026 → 19 years, retire in 2045", () => {
    // dob = 1980, retirementTargetAge = 65 → retirementYear = 1980 + 65 = 2045
    // yearsUntil = 2045 - 2026 = 19
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2056 },
      members: [
        {
          memberId: "m1",
          firstName: "Sam",
          lastName: "Test",
          dateOfBirth: "1980-01-01",
          currentAge: 46,
          retirementTargetAge: 65,
          lifeExpectancy: 90,
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
          currentBalance: 500_000,
          annualContribution: 10_000,
          expectedReturnRate: 0.07,
          isRetirementAccount: false,
        },
      ],
    });
    const result = computeYearsUntilRetirement(snap);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].retirementYear).toBe(2045);
    expect(result.members[0].yearsUntilRetirement).toBe(19);
    expect(result.members[0].alreadyRetired).toBe(false);
    expect(result.householdRetirementYear).toBe(2045);
    expect(result.yearsUntilHouseholdRetirement).toBe(19);
  });

  it("already retired member → yearsUntilRetirement is 0, alreadyRetired is true", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2041 },
      members: [
        {
          memberId: "m1",
          firstName: "Dana",
          lastName: "Test",
          dateOfBirth: "1961-01-01",
          currentAge: 65,
          retirementTargetAge: 65,
          lifeExpectancy: 85,
          isPrimary: true,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Savings",
          currentBalance: 500_000,
          annualContribution: 0,
          expectedReturnRate: 0.05,
          isRetirementAccount: false,
        },
      ],
    });
    const result = computeYearsUntilRetirement(snap);
    expect(result.members[0].alreadyRetired).toBe(true);
    expect(result.members[0].yearsUntilRetirement).toBe(0);
  });

  it("primaryMemberRetirementYear matches primary member", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2056 },
      members: [
        {
          memberId: "m1",
          firstName: "Alex",
          lastName: "Test",
          dateOfBirth: "1980-01-01",
          currentAge: 46,
          retirementTargetAge: 65,
          lifeExpectancy: 90,
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
          currentBalance: 500_000,
          annualContribution: 10_000,
          expectedReturnRate: 0.07,
          isRetirementAccount: false,
        },
      ],
    });
    const result = computeYearsUntilRetirement(snap);
    // primary dob 1980, retirementTargetAge 65 → retirementYear = 2045
    expect(result.primaryMemberRetirementYear).toBe(2045);
  });
});

// ---------------------------------------------------------------------------
// Retirement Income Projection
// ---------------------------------------------------------------------------
describe("computeRetirementIncomeProjection", () => {
  it("splits years correctly at retirement boundary", () => {
    // Member retires in 2045 (born 1980, retire at 65)
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2056 },
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
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "INDIVIDUAL",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 2_000_000,
          annualContribution: 20_000,
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
          annualAmount: 120_000,
          growthRate: 0.02,
          taxable: true,
          startYear: null,
          endYear: null,
          isPostRetirementIncome: false,
        },
      ],
    });
    const result = computeRetirementIncomeProjection(snap);

    expect(result.allYears.length).toBeGreaterThan(0);
    expect(result.firstRetirementYear).toBe(2045);

    // Pre-retirement years should all be before 2045
    for (const y of result.preRetirementYears) {
      expect(y.year).toBeLessThan(2045);
    }
    // Retirement years should all be >= 2045
    for (const y of result.retirementYears) {
      expect(y.year).toBeGreaterThanOrEqual(2045);
    }
    // Combined count equals allYears
    expect(result.preRetirementYears.length + result.retirementYears.length).toBe(result.allYears.length);
  });

  it("totalRetirementIncome equals sum of retirementYears totalIncome", () => {
    const snap = makeHealthySnap();
    const result = computeRetirementIncomeProjection(snap);
    const summedIncome = result.retirementYears.reduce((s, y) => s + y.totalIncome, 0);
    expect(result.totalRetirementIncome).toBeCloseTo(summedIncome, 0);
  });

  it("surplus = totalIncome - expenses for each year", () => {
    const snap = makeHealthySnap();
    const result = computeRetirementIncomeProjection(snap);
    for (const y of result.allYears.slice(0, 5)) {
      expect(y.surplus).toBeCloseTo(y.totalIncome - y.expenses, 0);
    }
  });

  it("yearsWithShortfall counts negative surplus years", () => {
    const snap = makeFailingSnap();
    const result = computeRetirementIncomeProjection(snap);
    const manualCount = result.allYears.filter(y => y.surplus < 0).length;
    expect(result.yearsWithShortfall).toBe(manualCount);
    expect(result.yearsWithShortfall).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Couple with staggered retirement ages
// ---------------------------------------------------------------------------
describe("Couple with staggered retirement ages", () => {
  it("householdRetirementYear is the later of the two retirement years", () => {
    // m1: born 1975, retire 65 → 2040
    // m2: born 1980, retire 62 → 2042
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2060 },
      household: {
        householdId: "test",
        planningMode: "COUPLE",
        filingStatus: "MARRIED_FILING_JOINTLY",
        stateOfResidence: "CA",
      },
      members: [
        {
          memberId: "m1",
          firstName: "Jordan",
          lastName: "Test",
          dateOfBirth: "1975-01-01",
          currentAge: 51,
          retirementTargetAge: 65,
          lifeExpectancy: 90,
          isPrimary: true,
        },
        {
          memberId: "m2",
          firstName: "Taylor",
          lastName: "Test",
          dateOfBirth: "1980-01-01",
          currentAge: 46,
          retirementTargetAge: 62,
          lifeExpectancy: 90,
          isPrimary: false,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: "m1",
          ownerType: "JOINT",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 1_500_000,
          annualContribution: 20_000,
          expectedReturnRate: 0.07,
          isRetirementAccount: false,
        },
      ],
      planningAssumptions: {
        inflationRate: 0.03,
        expectedPortfolioReturn: 0.07,
        assumedEffectiveTaxRate: 0.22,
        longevityTargets: { m1: 90, m2: 90 },
        retirementAgeOverrides: {},
      },
    });

    const result = computeYearsUntilRetirement(snap);
    expect(result.members).toHaveLength(2);

    const m1Summary = result.members.find(m => m.memberId === "m1");
    const m2Summary = result.members.find(m => m.memberId === "m2");

    expect(m1Summary?.retirementYear).toBe(2040); // 1975 + 65
    expect(m2Summary?.retirementYear).toBe(2042); // 1980 + 62
    expect(result.householdRetirementYear).toBe(2042); // later of the two
    expect(result.yearsUntilHouseholdRetirement).toBe(16); // 2042 - 2026

    expect(result.primaryMemberRetirementYear).toBe(2040); // m1 is primary
  });

  it("income projection: both members contribute pre-retirement income", () => {
    const snap = makeSnapshot({
      timeline: { simulationYearStart: 2026, projectionEndYear: 2055 },
      household: {
        householdId: "test",
        planningMode: "COUPLE",
        filingStatus: "MARRIED_FILING_JOINTLY",
        stateOfResidence: "CA",
      },
      members: [
        {
          memberId: "m1",
          firstName: "Jordan",
          lastName: "Test",
          dateOfBirth: "1975-01-01",
          currentAge: 51,
          retirementTargetAge: 65,
          lifeExpectancy: 90,
          isPrimary: true,
        },
        {
          memberId: "m2",
          firstName: "Taylor",
          lastName: "Test",
          dateOfBirth: "1980-01-01",
          currentAge: 46,
          retirementTargetAge: 65,
          lifeExpectancy: 90,
          isPrimary: false,
        },
      ],
      incomeSources: [
        {
          id: "inc1",
          memberId: "m1",
          type: "SALARY",
          label: "Jordan Salary",
          annualAmount: 100_000,
          growthRate: 0,
          taxable: true,
          startYear: null,
          endYear: null,
          isPostRetirementIncome: false,
        },
        {
          id: "inc2",
          memberId: "m2",
          type: "SALARY",
          label: "Taylor Salary",
          annualAmount: 80_000,
          growthRate: 0,
          taxable: true,
          startYear: null,
          endYear: null,
          isPostRetirementIncome: false,
        },
      ],
      assetAccounts: [
        {
          id: "acc1",
          memberId: null,
          ownerType: "JOINT",
          taxTreatment: "TAXABLE",
          accountName: "Brokerage",
          currentBalance: 1_000_000,
          annualContribution: 0,
          expectedReturnRate: 0.07,
          isRetirementAccount: false,
        },
      ],
      planningAssumptions: {
        inflationRate: 0.03,
        expectedPortfolioReturn: 0.07,
        assumedEffectiveTaxRate: 0.22,
        longevityTargets: { m1: 90, m2: 90 },
        retirementAgeOverrides: {},
      },
    });

    const result = computeRetirementIncomeProjection(snap);
    // In year 2026, both members work — combined earned income ~180k
    const yr2026 = result.allYears.find(y => y.year === 2026);
    expect(yr2026).toBeDefined();
    expect(yr2026!.earnedIncome).toBeGreaterThan(100_000);
  });
});
