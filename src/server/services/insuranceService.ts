import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function getInsuranceProfile(householdId: string) {
  return prisma.insuranceProfile.findUnique({ where: { householdId } });
}

export async function upsertInsuranceProfile(
  householdId: string,
  data: Omit<Prisma.InsuranceProfileUncheckedCreateInput, "householdId">
) {
  return prisma.insuranceProfile.upsert({
    where: { householdId },
    create: { ...data, householdId },
    update: data,
  });
}
