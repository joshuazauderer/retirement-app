import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function listLiabilities(householdId: string) {
  return prisma.liability.findMany({
    where: { householdId, isActive: true },
    include: { householdMember: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createLiability(
  householdId: string,
  data: Prisma.LiabilityUncheckedCreateInput
) {
  return prisma.liability.create({
    data: { ...data, householdId },
    include: { householdMember: true },
  });
}

export async function updateLiability(
  householdId: string,
  id: string,
  data: Partial<Prisma.LiabilityUncheckedUpdateInput>
) {
  const existing = await prisma.liability.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Liability not found");
  return prisma.liability.update({
    where: { id },
    data,
    include: { householdMember: true },
  });
}

export async function deleteLiability(householdId: string, id: string) {
  const existing = await prisma.liability.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Liability not found");
  return prisma.liability.update({ where: { id }, data: { isActive: false } });
}
