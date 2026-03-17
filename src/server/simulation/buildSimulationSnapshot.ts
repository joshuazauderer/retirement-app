import { PrismaClient } from "@prisma/client";
import type {
  SimulationSnapshot,
  NormalizedMember,
  NormalizedIncomeSource,
  NormalizedAssetAccount,
  NormalizedLiability,
  NormalizedExpenseProfile,
  NormalizedBenefitSource,
  NormalizedPlanningAssumptions,
} from "./types";
import {
  annualizeAmount,
  getMemberAgeAtYear,
  parseDecimalRate,
} from "./normalizeInputs";

export async function buildSimulationSnapshot(
  householdId: string,
  prisma: PrismaClient
): Promise<SimulationSnapshot> {
  // Load all data in parallel
  const [
    household,
    members,
    incomeSources,
    assetAccounts,
    liabilities,
    expenseProfile,
    benefitSources,
    assumptions,
  ] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: householdId } }),
    prisma.householdMember.findMany({ where: { householdId } }),
    prisma.incomeSource.findMany({ where: { householdId, isActive: true } }),
    prisma.assetAccount.findMany({ where: { householdId, isActive: true } }),
    prisma.liability.findMany({ where: { householdId } }),
    prisma.expenseProfile.findFirst({ where: { householdId } }),
    prisma.benefitSource.findMany({ where: { householdId, isActive: true } }),
    prisma.planningAssumptions.findFirst({ where: { householdId } }),
  ]);

  const currentYear = new Date().getFullYear();

  // Global return rate from planning assumptions (stored as decimal fraction e.g. 0.07)
  const globalReturn = parseDecimalRate(assumptions?.expectedPortfolioReturn ?? 0.07);

  // Determine projection end year from member longevity
  // Use parseInt on the ISO string to avoid timezone-shifting birth year.
  const memberLifeExpectancies = members.map((m) => {
    const birthYear = parseInt(m.dateOfBirth.toISOString().slice(0, 4), 10);
    const lifeExp =
      assumptions?.longevityTargetPrimary ?? m.lifeExpectancy ?? 90;
    return birthYear + lifeExp;
  });
  const projectionEndYear = Math.max(
    ...memberLifeExpectancies,
    currentYear + 30
  );

  // Normalize members
  const normalizedMembers: NormalizedMember[] = members.map((m, i) => {
    const dobIso = m.dateOfBirth.toISOString();
    const currentAge = getMemberAgeAtYear(dobIso, currentYear);
    const lifeExp =
      i === 0
        ? (assumptions?.longevityTargetPrimary ?? m.lifeExpectancy ?? 90)
        : (assumptions?.longevityTargetSpouse ?? m.lifeExpectancy ?? 90);
    return {
      memberId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      dateOfBirth: dobIso,
      currentAge,
      retirementTargetAge: m.retirementTargetAge,
      lifeExpectancy: lifeExp,
      isPrimary: m.relationshipType === "PRIMARY",
    };
  });

  // Normalize income sources
  // annualGrowthRate in schema: Decimal(5,4) — stored as fraction e.g. 0.0300 = 3%
  const normalizedIncome: NormalizedIncomeSource[] = incomeSources.map(
    (src) => ({
      id: src.id,
      memberId: src.householdMemberId,
      type: src.type,
      label: src.label,
      annualAmount: annualizeAmount(Number(src.amount), src.frequency),
      growthRate: parseDecimalRate(src.annualGrowthRate),
      taxable: src.taxable,
      startYear: src.startDate ? new Date(src.startDate).getFullYear() : null,
      endYear: src.endDate ? new Date(src.endDate).getFullYear() : null,
      isPostRetirementIncome: ["RENTAL", "BUSINESS", "PART_TIME", "OTHER"].includes(
        src.type
      ),
    })
  );

  // Normalize assets
  // expectedReturnRate in schema: Decimal(5,4) — stored as fraction
  const normalizedAssets: NormalizedAssetAccount[] = assetAccounts.map(
    (acc) => ({
      id: acc.id,
      memberId: acc.householdMemberId ?? null,
      ownerType: acc.ownerType,
      taxTreatment: acc.taxTreatment as
        | "TAXABLE"
        | "TAX_DEFERRED"
        | "TAX_FREE"
        | "MIXED",
      accountName: acc.accountName,
      currentBalance: Number(acc.currentBalance),
      annualContribution:
        acc.annualContributionAmount && acc.contributionFrequency
          ? annualizeAmount(
              Number(acc.annualContributionAmount),
              acc.contributionFrequency
            )
          : 0,
      expectedReturnRate: acc.expectedReturnRate
        ? parseDecimalRate(acc.expectedReturnRate)
        : globalReturn,
      isRetirementAccount: [
        "TRADITIONAL_401K",
        "ROTH_401K",
        "TRADITIONAL_IRA",
        "ROTH_IRA",
        "HSA",
        "ANNUITY",
      ].includes(acc.type),
    })
  );

  // Normalize liabilities
  // monthlyPayment in schema: Decimal(10,2)
  // interestRate: Decimal(5,4) — stored as fraction
  const normalizedLiabilities: NormalizedLiability[] = liabilities.map(
    (lib) => ({
      id: lib.id,
      type: lib.type,
      label: lib.label,
      currentBalance: Number(lib.currentBalance),
      interestRate: parseDecimalRate(lib.interestRate),
      annualPayment: lib.monthlyPayment ? Number(lib.monthlyPayment) * 12 : 0,
      payoffYear: lib.payoffDate ? new Date(lib.payoffDate).getFullYear() : null,
    })
  );

  // Normalize expense profile
  // All fields in schema are monthly — multiply by 12 to annualize
  // inflationAssumption: Decimal(5,4) — stored as fraction
  const inflationRate = expenseProfile?.inflationAssumption
    ? parseDecimalRate(expenseProfile.inflationAssumption)
    : parseDecimalRate(assumptions?.inflationRate ?? 0.03);

  const normalizedExpenses: NormalizedExpenseProfile = expenseProfile
    ? {
        currentAnnualSpending:
          Number(expenseProfile.currentMonthlySpending) * 12,
        retirementEssential:
          Number(expenseProfile.retirementMonthlyEssential) * 12,
        retirementDiscretionary:
          Number(expenseProfile.retirementMonthlyDiscretionary) * 12,
        healthcareAnnual:
          Number(expenseProfile.healthcareMonthlyEstimate) * 12,
        housingAnnual: Number(expenseProfile.housingMonthlyEstimate) * 12,
        inflationRate,
      }
    : {
        currentAnnualSpending: 60000,
        retirementEssential: 40000,
        retirementDiscretionary: 20000,
        healthcareAnnual: 6000,
        housingAnnual: 0,
        inflationRate,
      };

  // Normalize benefit sources
  // estimatedMonthlyBenefit in schema: Decimal(10,2)
  // colaRate: Decimal(5,4) — stored as fraction (default 0.023)
  // claimAge: Int (non-nullable in schema)
  // survivorEligible: Boolean?
  // Note: BenefitSource has no `taxable` field in schema; default to true for all
  const normalizedBenefits: NormalizedBenefitSource[] = benefitSources.map(
    (b) => ({
      id: b.id,
      memberId: b.householdMemberId,
      type: b.type,
      label: b.label,
      annualBenefit: Number(b.estimatedMonthlyBenefit) * 12,
      claimAge: b.claimAge,
      startYear: b.startDate ? new Date(b.startDate).getFullYear() : null,
      colaRate: b.colaRate ? parseDecimalRate(b.colaRate) : 0.023,
      taxable: true, // BenefitSource has no taxable field; assume taxable
      survivorEligible: b.survivorEligible ?? false,
    })
  );

  // Planning assumptions
  // assumedTaxRate: Decimal(5,4) stored as fraction (e.g. 0.22 = 22%)
  const normalizedAssumptions: NormalizedPlanningAssumptions = {
    inflationRate: parseDecimalRate(assumptions?.inflationRate ?? 0.03),
    expectedPortfolioReturn: globalReturn,
    assumedEffectiveTaxRate: parseDecimalRate(
      assumptions?.assumedTaxRate ?? 0.22
    ),
    longevityTargets: Object.fromEntries(
      normalizedMembers.map((m) => [m.memberId, m.lifeExpectancy])
    ),
    retirementAgeOverrides: {},
  };

  return {
    metadata: {
      engineVersion: "1.0.0",
      snapshotGeneratedAt: new Date().toISOString(),
      householdId,
      scenarioLabel: "Baseline",
    },
    timeline: {
      simulationYearStart: currentYear,
      projectionEndYear,
    },
    household: {
      householdId,
      planningMode: members.length > 1 ? "COUPLE" : "INDIVIDUAL",
      filingStatus: household.filingStatus,
      stateOfResidence: household.stateOfResidence ?? "CA",
    },
    members: normalizedMembers,
    incomeSources: normalizedIncome,
    assetAccounts: normalizedAssets,
    liabilities: normalizedLiabilities,
    expenseProfile: normalizedExpenses,
    benefitSources: normalizedBenefits,
    planningAssumptions: normalizedAssumptions,
  };
}
