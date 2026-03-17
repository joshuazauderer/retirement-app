import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("Password123!", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@retireplan.app" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@retireplan.app",
      password,
      emailVerified: new Date(),
    },
  });

  const household = await prisma.household.upsert({
    where: { primaryUserId: user.id },
    update: {},
    create: {
      name: "Demo Household",
      primaryUserId: user.id,
      filingStatus: "MARRIED_FILING_JOINTLY",
      stateOfResidence: "CA",
      planningMode: "COUPLE",
    },
  });

  await prisma.householdMember.deleteMany({ where: { householdId: household.id } });

  await prisma.householdMember.createMany({
    data: [
      {
        householdId: household.id,
        firstName: "Demo",
        lastName: "User",
        relationshipType: "PRIMARY",
        dateOfBirth: new Date("1980-06-15"),
        retirementTargetAge: 65,
        lifeExpectancy: 90,
      },
      {
        householdId: household.id,
        firstName: "Jane",
        lastName: "User",
        relationshipType: "SPOUSE",
        dateOfBirth: new Date("1982-03-22"),
        retirementTargetAge: 63,
        lifeExpectancy: 92,
      },
    ],
  });

  console.log("Seed complete. Demo account: demo@retireplan.app / Password123!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
