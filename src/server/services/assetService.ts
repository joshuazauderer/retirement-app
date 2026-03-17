import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function listAssetAccounts(householdId: string) {
  return prisma.assetAccount.findMany({
    where: { householdId, isActive: true },
    include: { householdMember: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAssetAccount(
  householdId: string,
  data: Prisma.AssetAccountUncheckedCreateInput
) {
  return prisma.assetAccount.create({
    data: { ...data, householdId },
    include: { householdMember: true },
  });
}

export async function updateAssetAccount(
  householdId: string,
  id: string,
  data: Partial<Prisma.AssetAccountUncheckedUpdateInput>
) {
  const existing = await prisma.assetAccount.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Asset account not found");
  return prisma.assetAccount.update({
    where: { id },
    data,
    include: { householdMember: true },
  });
}

export async function deleteAssetAccount(householdId: string, id: string) {
  const existing = await prisma.assetAccount.findFirst({
    where: { id, householdId },
  });
  if (!existing) throw new Error("Asset account not found");
  return prisma.assetAccount.update({ where: { id }, data: { isActive: false } });
}
