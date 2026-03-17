import { prisma } from "@/lib/prisma";

export interface CompletionCategory {
  name: string;
  key: string;
  weight: number;
  complete: boolean;
  score: number;
}

export interface ProfileCompletion {
  categories: CompletionCategory[];
  totalScore: number;
  totalWeight: number;
  percentage: number;
}

export async function getProfileCompletion(
  householdId: string
): Promise<ProfileCompletion> {
  const [
    income,
    assets,
    liabilities,
    expenses,
    benefits,
    properties,
    insurance,
    assumptions,
    household,
  ] = await Promise.all([
    prisma.incomeSource.count({ where: { householdId, isActive: true } }),
    prisma.assetAccount.count({ where: { householdId, isActive: true } }),
    prisma.liability.count({ where: { householdId, isActive: true } }),
    prisma.expenseProfile.findUnique({ where: { householdId } }),
    prisma.benefitSource.count({ where: { householdId, isActive: true } }),
    prisma.realEstateProperty.count({ where: { householdId } }),
    prisma.insuranceProfile.findUnique({ where: { householdId } }),
    prisma.planningAssumptions.findUnique({ where: { householdId } }),
    prisma.household.findUnique({
      where: { id: householdId },
      include: { members: true },
    }),
  ]);

  const hasHousehold = !!household && household.members.length > 0;

  const categories: CompletionCategory[] = [
    {
      name: "Household Setup",
      key: "household",
      weight: 10,
      complete: hasHousehold,
      score: hasHousehold ? 10 : 0,
    },
    {
      name: "Income",
      key: "income",
      weight: 20,
      complete: income > 0,
      score: income > 0 ? 20 : 0,
    },
    {
      name: "Assets",
      key: "assets",
      weight: 20,
      complete: assets > 0,
      score: assets > 0 ? 20 : 0,
    },
    {
      name: "Liabilities",
      key: "liabilities",
      weight: 10,
      complete: liabilities > 0,
      score: liabilities > 0 ? 10 : 0,
    },
    {
      name: "Expenses",
      key: "expenses",
      weight: 15,
      complete: !!expenses,
      score: expenses ? 15 : 0,
    },
    {
      name: "Benefits",
      key: "benefits",
      weight: 10,
      complete: benefits > 0,
      score: benefits > 0 ? 10 : 0,
    },
    {
      name: "Housing",
      key: "housing",
      weight: 5,
      complete: properties > 0,
      score: properties > 0 ? 5 : 0,
    },
    {
      name: "Insurance",
      key: "insurance",
      weight: 5,
      complete: !!insurance,
      score: insurance ? 5 : 0,
    },
    {
      name: "Assumptions",
      key: "assumptions",
      weight: 5,
      complete: !!assumptions,
      score: assumptions ? 5 : 0,
    },
  ];

  const totalWeight = categories.reduce((s, c) => s + c.weight, 0);
  const totalScore = categories.reduce((s, c) => s + c.score, 0);
  const percentage = Math.round((totalScore / totalWeight) * 100);

  return { categories, totalScore, totalWeight, percentage };
}
