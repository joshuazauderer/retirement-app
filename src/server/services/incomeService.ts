import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function listIncomeSources(householdId: string) {
  return prisma.incomeSource.findMany({
    where: { householdId, isActive: true },
    include: { householdMember: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createIncomeSource(
  householdId: string,
  data: Prisma.IncomeSourceUncheckedCreateInput
) {
  return prisma.incomeSource.create({
    data: { ...data, householdId },
    include: { householdMember: true },
  });
}

export async function updateIncomeSource(
  householdId: string,
  id: string,
  data: Partial<Prisma.IncomeSourceUncheckedUpdateInput>
) {
  const existing = await prisma.incomeSource.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Income source not found");
  return prisma.incomeSource.update({
    where: { id },
    data,
    include: { householdMember: true },
  });
}

export async function deleteIncomeSource(householdId: string, id: string) {
  const existing = await prisma.incomeSource.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Income source not found");
  return prisma.incomeSource.update({ where: { id }, data: { isActive: false } });
}

export function annualizeAmount(amount: number, frequency: string): number {
  const multipliers: Record<string, number> = {
    WEEKLY: 52,
    BIWEEKLY: 26,
    MONTHLY: 12,
    QUARTERLY: 4,
    ANNUALLY: 1,
  };
  return amount * (multipliers[frequency] ?? 1);
}
