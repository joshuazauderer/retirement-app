import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function listRealEstateProperties(householdId: string) {
  return prisma.realEstateProperty.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRealEstateProperty(
  householdId: string,
  data: Omit<Prisma.RealEstatePropertyUncheckedCreateInput, "householdId">
) {
  return prisma.realEstateProperty.create({ data: { ...data, householdId } });
}

export async function updateRealEstateProperty(
  householdId: string,
  id: string,
  data: Partial<Prisma.RealEstatePropertyUncheckedUpdateInput>
) {
  const existing = await prisma.realEstateProperty.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Property not found");
  return prisma.realEstateProperty.update({ where: { id }, data });
}

export async function deleteRealEstateProperty(householdId: string, id: string) {
  const existing = await prisma.realEstateProperty.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Property not found");
  return prisma.realEstateProperty.delete({ where: { id } });
}
