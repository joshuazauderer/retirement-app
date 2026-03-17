import {
  PrismaClient,
  IncomeType,
  IncomeFrequency,
  AssetType,
  AssetOwnerType,
  AssetTaxTreatment,
  LiabilityType,
  BenefitType,
  PropertyType,
  PropertyOwnershipType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ---- Original demo user ----
  const password = await bcrypt.hash("Password123!", 12);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@retireplan.app" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@retireplan.app",
      password,
      emailVerified: new Date(),
    },
  });

  const demoHousehold = await prisma.household.upsert({
    where: { primaryUserId: demoUser.id },
    update: {},
    create: {
      name: "Demo Household",
      primaryUserId: demoUser.id,
      filingStatus: "MARRIED_FILING_JOINTLY",
      stateOfResidence: "CA",
      planningMode: "COUPLE",
    },
  });

  await prisma.householdMember.deleteMany({
    where: { householdId: demoHousehold.id },
  });

  await prisma.householdMember.createMany({
    data: [
      {
        householdId: demoHousehold.id,
        firstName: "Demo",
        lastName: "User",
        relationshipType: "PRIMARY",
        dateOfBirth: new Date("1980-06-15"),
        retirementTargetAge: 65,
        lifeExpectancy: 90,
      },
      {
        householdId: demoHousehold.id,
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

  // ---- Phase 2 test users ----
  const pw = await bcrypt.hash("TestPass123!", 10);

  const user1 = await prisma.user.upsert({
    where: { email: "alex.johnson@example.com" },
    update: {},
    create: {
      email: "alex.johnson@example.com",
      name: "Alex Johnson",
      password: pw,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "sam.chen@example.com" },
    update: {},
    create: {
      email: "sam.chen@example.com",
      name: "Sam Chen",
      password: pw,
    },
  });

  // Household 1: Single person
  let hh1 = await prisma.household.findUnique({
    where: { primaryUserId: user1.id },
  });
  if (!hh1) {
    hh1 = await prisma.household.create({
      data: {
        name: "Alex Johnson's Household",
        primaryUserId: user1.id,
        filingStatus: "SINGLE",
        stateOfResidence: "CA",
        planningMode: "INDIVIDUAL",
      },
    });
  }

  let member1 = await prisma.householdMember.findFirst({
    where: { householdId: hh1.id, relationshipType: "PRIMARY" },
  });
  if (!member1) {
    member1 = await prisma.householdMember.create({
      data: {
        householdId: hh1.id,
        firstName: "Alex",
        lastName: "Johnson",
        relationshipType: "PRIMARY",
        dateOfBirth: new Date("1979-03-15"),
        retirementTargetAge: 65,
        lifeExpectancy: 88,
      },
    });
  }

  // Income sources for hh1
  await prisma.incomeSource.upsert({
    where: { id: "seed-income-1" },
    update: {},
    create: {
      id: "seed-income-1",
      householdId: hh1.id,
      householdMemberId: member1.id,
      type: IncomeType.SALARY,
      label: "Software Engineer Salary",
      amount: 12500,
      frequency: IncomeFrequency.MONTHLY,
      taxable: true,
      annualGrowthRate: 0.03,
      isActive: true,
    },
  });

  // Assets for hh1
  await prisma.assetAccount.upsert({
    where: { id: "seed-asset-1" },
    update: {},
    create: {
      id: "seed-asset-1",
      householdId: hh1.id,
      householdMemberId: member1.id,
      ownerType: AssetOwnerType.INDIVIDUAL,
      type: AssetType.TRADITIONAL_401K,
      institutionName: "Fidelity",
      accountName: "401(k) - Employer Plan",
      currentBalance: 285000,
      annualContributionAmount: 23000,
      contributionFrequency: IncomeFrequency.ANNUALLY,
      employerMatchPercent: 0.04,
      taxTreatment: AssetTaxTreatment.TAX_DEFERRED,
      expectedReturnRate: 0.07,
      isActive: true,
    },
  });

  await prisma.assetAccount.upsert({
    where: { id: "seed-asset-2" },
    update: {},
    create: {
      id: "seed-asset-2",
      householdId: hh1.id,
      householdMemberId: member1.id,
      ownerType: AssetOwnerType.INDIVIDUAL,
      type: AssetType.ROTH_IRA,
      institutionName: "Vanguard",
      accountName: "Roth IRA",
      currentBalance: 68000,
      annualContributionAmount: 7000,
      contributionFrequency: IncomeFrequency.ANNUALLY,
      taxTreatment: AssetTaxTreatment.TAX_FREE,
      expectedReturnRate: 0.07,
      isActive: true,
    },
  });

  await prisma.assetAccount.upsert({
    where: { id: "seed-asset-3" },
    update: {},
    create: {
      id: "seed-asset-3",
      householdId: hh1.id,
      householdMemberId: member1.id,
      ownerType: AssetOwnerType.INDIVIDUAL,
      type: AssetType.CHECKING,
      institutionName: "Chase",
      accountName: "Checking Account",
      currentBalance: 18000,
      taxTreatment: AssetTaxTreatment.TAXABLE,
      isActive: true,
    },
  });

  // Liabilities for hh1
  await prisma.liability.upsert({
    where: { id: "seed-liability-1" },
    update: {},
    create: {
      id: "seed-liability-1",
      householdId: hh1.id,
      type: LiabilityType.MORTGAGE,
      label: "Home Mortgage",
      lenderName: "Wells Fargo",
      currentBalance: 420000,
      interestRate: 0.0675,
      monthlyPayment: 2750,
      isSecured: true,
      isActive: true,
    },
  });

  // Benefits for hh1
  await prisma.benefitSource.upsert({
    where: { id: "seed-benefit-1" },
    update: {},
    create: {
      id: "seed-benefit-1",
      householdId: hh1.id,
      householdMemberId: member1.id,
      type: BenefitType.SOCIAL_SECURITY,
      label: "Social Security (age 67)",
      estimatedMonthlyBenefit: 2800,
      claimAge: 67,
      colaRate: 0.023,
      isActive: true,
    },
  });

  // Real estate for hh1
  await prisma.realEstateProperty.upsert({
    where: { id: "seed-property-1" },
    update: {},
    create: {
      id: "seed-property-1",
      householdId: hh1.id,
      type: PropertyType.PRIMARY_RESIDENCE,
      label: "Primary Home - San Jose, CA",
      ownershipType: PropertyOwnershipType.INDIVIDUAL,
      currentMarketValue: 895000,
      mortgageBalance: 420000,
      monthlyMortgagePayment: 2750,
      annualPropertyTax: 9500,
      annualInsuranceCost: 2400,
      annualMaintenanceEstimate: 8000,
      isPrimaryResidence: true,
      downsizingCandidate: false,
    },
  });

  // Expense profile for hh1
  await prisma.expenseProfile.upsert({
    where: { householdId: hh1.id },
    update: {},
    create: {
      householdId: hh1.id,
      currentMonthlySpending: 7500,
      retirementMonthlyEssential: 4000,
      retirementMonthlyDiscretionary: 2500,
      healthcareMonthlyEstimate: 800,
      housingMonthlyEstimate: 2750,
      travelMonthlyEstimate: 500,
      inflationAssumption: 0.03,
    },
  });

  // Insurance for hh1
  await prisma.insuranceProfile.upsert({
    where: { householdId: hh1.id },
    update: {},
    create: {
      householdId: hh1.id,
      healthInsuranceStatus: "employer",
      longTermCareCoverage: false,
      lifeInsuranceCoverageAmount: 500000,
      disabilityCoverageFlag: true,
      umbrellaCoverageFlag: false,
    },
  });

  // Planning assumptions for hh1
  await prisma.planningAssumptions.upsert({
    where: { householdId: hh1.id },
    update: {},
    create: {
      householdId: hh1.id,
      inflationRate: 0.03,
      expectedPortfolioReturn: 0.07,
      expectedPortfolioVolatility: 0.12,
      longevityTargetPrimary: 88,
      assumedTaxRate: 0.22,
      simulationCountDefault: 1000,
    },
  });

  // ---- Household 2: Couple ----
  let hh2 = await prisma.household.findUnique({
    where: { primaryUserId: user2.id },
  });
  if (!hh2) {
    hh2 = await prisma.household.create({
      data: {
        name: "Sam & Jamie Chen's Household",
        primaryUserId: user2.id,
        filingStatus: "MARRIED_FILING_JOINTLY",
        stateOfResidence: "TX",
        planningMode: "COUPLE",
      },
    });
  }

  let member2a = await prisma.householdMember.findFirst({
    where: { householdId: hh2.id, relationshipType: "PRIMARY" },
  });
  if (!member2a) {
    member2a = await prisma.householdMember.create({
      data: {
        householdId: hh2.id,
        firstName: "Sam",
        lastName: "Chen",
        relationshipType: "PRIMARY",
        dateOfBirth: new Date("1968-07-22"),
        retirementTargetAge: 62,
        lifeExpectancy: 85,
      },
    });
  }

  let member2b = await prisma.householdMember.findFirst({
    where: { householdId: hh2.id, relationshipType: "SPOUSE" },
  });
  if (!member2b) {
    member2b = await prisma.householdMember.create({
      data: {
        householdId: hh2.id,
        firstName: "Jamie",
        lastName: "Chen",
        relationshipType: "SPOUSE",
        dateOfBirth: new Date("1970-11-08"),
        retirementTargetAge: 65,
        lifeExpectancy: 90,
      },
    });
  }

  // Income for hh2
  await prisma.incomeSource.upsert({
    where: { id: "seed-income-2" },
    update: {},
    create: {
      id: "seed-income-2",
      householdId: hh2.id,
      householdMemberId: member2a.id,
      type: IncomeType.SALARY,
      label: "Sam - Teacher Salary",
      amount: 72000,
      frequency: IncomeFrequency.ANNUALLY,
      taxable: true,
      isActive: true,
    },
  });

  await prisma.incomeSource.upsert({
    where: { id: "seed-income-3" },
    update: {},
    create: {
      id: "seed-income-3",
      householdId: hh2.id,
      householdMemberId: member2b.id,
      type: IncomeType.SALARY,
      label: "Jamie - Nurse Salary",
      amount: 88000,
      frequency: IncomeFrequency.ANNUALLY,
      taxable: true,
      isActive: true,
    },
  });

  // Assets for hh2
  await prisma.assetAccount.upsert({
    where: { id: "seed-asset-4" },
    update: {},
    create: {
      id: "seed-asset-4",
      householdId: hh2.id,
      householdMemberId: member2a.id,
      ownerType: AssetOwnerType.INDIVIDUAL,
      type: AssetType.TRADITIONAL_401K,
      institutionName: "TIAA",
      accountName: "403(b) - Teachers Plan",
      currentBalance: 425000,
      taxTreatment: AssetTaxTreatment.TAX_DEFERRED,
      expectedReturnRate: 0.065,
      isActive: true,
    },
  });

  await prisma.assetAccount.upsert({
    where: { id: "seed-asset-5" },
    update: {},
    create: {
      id: "seed-asset-5",
      householdId: hh2.id,
      ownerType: AssetOwnerType.JOINT,
      type: AssetType.BROKERAGE,
      institutionName: "Schwab",
      accountName: "Joint Brokerage",
      currentBalance: 195000,
      taxTreatment: AssetTaxTreatment.TAXABLE,
      expectedReturnRate: 0.07,
      isActive: true,
    },
  });

  // Benefits for hh2
  await prisma.benefitSource.upsert({
    where: { id: "seed-benefit-2" },
    update: {},
    create: {
      id: "seed-benefit-2",
      householdId: hh2.id,
      householdMemberId: member2a.id,
      type: BenefitType.PENSION,
      label: "Sam - Teacher Pension",
      estimatedMonthlyBenefit: 3200,
      claimAge: 62,
      colaRate: 0.02,
      survivorEligible: true,
      isActive: true,
    },
  });

  await prisma.benefitSource.upsert({
    where: { id: "seed-benefit-3" },
    update: {},
    create: {
      id: "seed-benefit-3",
      householdId: hh2.id,
      householdMemberId: member2b.id,
      type: BenefitType.SOCIAL_SECURITY,
      label: "Jamie - Social Security",
      estimatedMonthlyBenefit: 2200,
      claimAge: 67,
      colaRate: 0.023,
      survivorEligible: true,
      isActive: true,
    },
  });

  // Planning assumptions for hh2
  await prisma.planningAssumptions.upsert({
    where: { householdId: hh2.id },
    update: {},
    create: {
      householdId: hh2.id,
      inflationRate: 0.03,
      expectedPortfolioReturn: 0.065,
      expectedPortfolioVolatility: 0.1,
      longevityTargetPrimary: 85,
      longevityTargetSpouse: 90,
      assumedTaxRate: 0.24,
      simulationCountDefault: 1000,
    },
  });

  // Expense profile for hh2
  await prisma.expenseProfile.upsert({
    where: { householdId: hh2.id },
    update: {},
    create: {
      householdId: hh2.id,
      currentMonthlySpending: 9200,
      retirementMonthlyEssential: 5500,
      retirementMonthlyDiscretionary: 2800,
      healthcareMonthlyEstimate: 1200,
      housingMonthlyEstimate: 1800,
      travelMonthlyEstimate: 800,
      inflationAssumption: 0.03,
    },
  });

  console.log("Phase 2 seed complete.");
  console.log("Test accounts: alex.johnson@example.com / TestPass123!");
  console.log("              sam.chen@example.com / TestPass123!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
