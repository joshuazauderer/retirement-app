import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function getPlanningAssumptions(householdId: string) {
  return prisma.planningAssumptions.findUnique({ where: { householdId } });
}

export async function upsertPlanningAssumptions(
  householdId: string,
  data: Omit<Prisma.PlanningAssumptionsUncheckedCreateInput, "householdId">
) {
  return prisma.planningAssumptions.upsert({
    where: { householdId },
    create: { ...data, householdId },
    update: data,
  });
}
