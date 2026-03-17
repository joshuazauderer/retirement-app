import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function listBenefitSources(householdId: string) {
  return prisma.benefitSource.findMany({
    where: { householdId, isActive: true },
    include: { householdMember: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createBenefitSource(
  householdId: string,
  data: Prisma.BenefitSourceUncheckedCreateInput
) {
  return prisma.benefitSource.create({
    data: { ...data, householdId },
    include: { householdMember: true },
  });
}

export async function updateBenefitSource(
  householdId: string,
  id: string,
  data: Partial<Prisma.BenefitSourceUncheckedUpdateInput>
) {
  const existing = await prisma.benefitSource.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Benefit source not found");
  return prisma.benefitSource.update({
    where: { id },
    data,
    include: { householdMember: true },
  });
}

export async function deleteBenefitSource(householdId: string, id: string) {
  const existing = await prisma.benefitSource.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Benefit source not found");
  return prisma.benefitSource.update({ where: { id }, data: { isActive: false } });
}
