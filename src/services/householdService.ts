import { prisma } from "@/lib/prisma";
import { householdSchema, memberSchema, type HouseholdInput, type MemberInput } from "@/lib/validations/household";

export class HouseholdServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "HouseholdServiceError";
  }
}

export const householdService = {
  async createHousehold(userId: string, input: HouseholdInput) {
    const parsed = householdSchema.safeParse(input);
    if (!parsed.success) {
      throw new HouseholdServiceError(parsed.error.issues[0].message, "VALIDATION_ERROR");
    }

    const existing = await prisma.household.findUnique({
      where: { primaryUserId: userId },
    });

    if (existing) {
      throw new HouseholdServiceError("Household already exists", "HOUSEHOLD_EXISTS");
    }

    return prisma.household.create({
      data: {
        ...parsed.data,
        primaryUserId: userId,
      },
      include: { members: true },
    });
  },

  async addMember(householdId: string, userId: string, input: MemberInput) {
    const household = await prisma.household.findFirst({
      where: { id: householdId, primaryUserId: userId },
    });

    if (!household) {
      throw new HouseholdServiceError("Household not found", "NOT_FOUND");
    }

    const parsed = memberSchema.safeParse(input);
    if (!parsed.success) {
      throw new HouseholdServiceError(parsed.error.issues[0].message, "VALIDATION_ERROR");
    }

    return prisma.householdMember.create({
      data: {
        ...parsed.data,
        dateOfBirth: new Date(parsed.data.dateOfBirth),
        householdId,
      },
    });
  },

  async getHouseholdByUserId(userId: string) {
    return prisma.household.findUnique({
      where: { primaryUserId: userId },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  },

  async updateHousehold(householdId: string, userId: string, data: Partial<HouseholdInput>) {
    const household = await prisma.household.findFirst({
      where: { id: householdId, primaryUserId: userId },
    });

    if (!household) {
      throw new HouseholdServiceError("Household not found", "NOT_FOUND");
    }

    return prisma.household.update({
      where: { id: householdId },
      data,
      include: { members: true },
    });
  },
};
