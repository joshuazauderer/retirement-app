import { prisma } from "@/lib/prisma";
import { annualizeAmount } from "./incomeService";

export async function getHouseholdOverview(householdId: string) {
  const [
    income,
    assets,
    liabilities,
    benefits,
    properties,
    expenses,
    assumptions,
    household,
  ] = await Promise.all([
    prisma.incomeSource.findMany({ where: { householdId, isActive: true } }),
    prisma.assetAccount.findMany({ where: { householdId, isActive: true } }),
    prisma.liability.findMany({ where: { householdId, isActive: true } }),
    prisma.benefitSource.findMany({ where: { householdId, isActive: true } }),
    prisma.realEstateProperty.findMany({ where: { householdId } }),
    prisma.expenseProfile.findUnique({ where: { householdId } }),
    prisma.planningAssumptions.findUnique({ where: { householdId } }),
    prisma.household.findUnique({
      where: { id: householdId },
      include: { members: true },
    }),
  ]);

  const totalAnnualIncome = income.reduce((sum, s) => {
    return sum + annualizeAmount(Number(s.amount), s.frequency);
  }, 0);

  const totalAssets = assets.reduce(
    (sum, a) => sum + Number(a.currentBalance),
    0
  );
  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum + Number(l.currentBalance),
    0
  );
  const totalRealEstateValue = properties.reduce(
    (sum, p) => sum + Number(p.currentMarketValue),
    0
  );
  const totalRealEstateMortgage = properties.reduce(
    (sum, p) => sum + Number(p.mortgageBalance ?? 0),
    0
  );
  const netWorth =
    totalAssets +
    totalRealEstateValue -
    totalLiabilities -
    totalRealEstateMortgage;

  const monthlyRetirementSpending = expenses
    ? Number(expenses.retirementMonthlyEssential) +
      Number(expenses.retirementMonthlyDiscretionary)
    : null;

  return {
    totalAnnualIncome,
    totalAssets,
    totalLiabilities,
    totalRealEstateValue,
    netWorth,
    monthlyRetirementSpending,
    activeBenefitsCount: benefits.length,
    propertiesCount: properties.length,
    incomeSourcesCount: income.length,
    liabilitiesCount: liabilities.length,
    household,
    assumptions,
  };
}
