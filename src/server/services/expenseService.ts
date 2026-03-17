import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function getExpenseProfile(householdId: string) {
  return prisma.expenseProfile.findUnique({ where: { householdId } });
}

export async function upsertExpenseProfile(
  householdId: string,
  data: Omit<Prisma.ExpenseProfileUncheckedCreateInput, "householdId">
) {
  return prisma.expenseProfile.upsert({
    where: { householdId },
    create: { ...data, householdId },
    update: data,
  });
}
