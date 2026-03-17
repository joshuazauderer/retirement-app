-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('SALARY', 'BONUS', 'PENSION', 'RENTAL', 'BUSINESS', 'PART_TIME', 'OTHER');

-- CreateEnum
CREATE TYPE "IncomeFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "AssetOwnerType" AS ENUM ('INDIVIDUAL', 'JOINT', 'HOUSEHOLD');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CHECKING', 'SAVINGS', 'BROKERAGE', 'TRADITIONAL_401K', 'ROTH_401K', 'TRADITIONAL_IRA', 'ROTH_IRA', 'HSA', 'ANNUITY', 'CASH', 'CD', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetTaxTreatment" AS ENUM ('TAXABLE', 'TAX_DEFERRED', 'TAX_FREE', 'MIXED');

-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN', 'CREDIT_CARD', 'PERSONAL_LOAN', 'HELOC', 'OTHER');

-- CreateEnum
CREATE TYPE "BenefitType" AS ENUM ('SOCIAL_SECURITY', 'PENSION', 'ANNUITY_INCOME', 'VETERANS_BENEFIT', 'DISABILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('PRIMARY_RESIDENCE', 'VACATION_HOME', 'RENTAL_PROPERTY', 'LAND', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyOwnershipType" AS ENUM ('INDIVIDUAL', 'JOINT', 'HOUSEHOLD');

-- CreateTable
CREATE TABLE "income_sources" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "householdMemberId" TEXT NOT NULL,
    "type" "IncomeType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "IncomeFrequency" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "annualGrowthRate" DECIMAL(5,4),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_accounts" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "householdMemberId" TEXT,
    "ownerType" "AssetOwnerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "type" "AssetType" NOT NULL,
    "institutionName" TEXT,
    "accountName" TEXT NOT NULL,
    "currentBalance" DECIMAL(14,2) NOT NULL,
    "annualContributionAmount" DECIMAL(12,2),
    "contributionFrequency" "IncomeFrequency",
    "employerMatchAmount" DECIMAL(12,2),
    "employerMatchPercent" DECIMAL(5,4),
    "taxTreatment" "AssetTaxTreatment" NOT NULL,
    "expectedReturnRate" DECIMAL(5,4),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liabilities" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "householdMemberId" TEXT,
    "type" "LiabilityType" NOT NULL,
    "label" TEXT NOT NULL,
    "lenderName" TEXT,
    "currentBalance" DECIMAL(14,2) NOT NULL,
    "interestRate" DECIMAL(5,4),
    "monthlyPayment" DECIMAL(10,2),
    "payoffDate" TIMESTAMP(3),
    "isSecured" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_profiles" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "currentMonthlySpending" DECIMAL(10,2) NOT NULL,
    "retirementMonthlyEssential" DECIMAL(10,2) NOT NULL,
    "retirementMonthlyDiscretionary" DECIMAL(10,2) NOT NULL,
    "healthcareMonthlyEstimate" DECIMAL(10,2) NOT NULL,
    "housingMonthlyEstimate" DECIMAL(10,2) NOT NULL,
    "travelMonthlyEstimate" DECIMAL(10,2),
    "otherMonthlyEstimate" DECIMAL(10,2),
    "inflationAssumption" DECIMAL(5,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_sources" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "householdMemberId" TEXT NOT NULL,
    "type" "BenefitType" NOT NULL,
    "label" TEXT NOT NULL,
    "estimatedMonthlyBenefit" DECIMAL(10,2) NOT NULL,
    "claimAge" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "colaRate" DECIMAL(5,4),
    "survivorEligible" BOOLEAN,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "real_estate_properties" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "label" TEXT NOT NULL,
    "ownershipType" "PropertyOwnershipType" NOT NULL DEFAULT 'JOINT',
    "currentMarketValue" DECIMAL(14,2) NOT NULL,
    "mortgageBalance" DECIMAL(14,2),
    "monthlyMortgagePayment" DECIMAL(10,2),
    "annualPropertyTax" DECIMAL(10,2),
    "annualInsuranceCost" DECIMAL(10,2),
    "annualMaintenanceEstimate" DECIMAL(10,2),
    "isPrimaryResidence" BOOLEAN NOT NULL DEFAULT false,
    "downsizingCandidate" BOOLEAN NOT NULL DEFAULT false,
    "expectedSaleYear" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "real_estate_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_profiles" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "healthInsuranceStatus" TEXT NOT NULL,
    "longTermCareCoverage" BOOLEAN NOT NULL DEFAULT false,
    "lifeInsuranceCoverageAmount" DECIMAL(14,2),
    "lifeInsuranceNotes" TEXT,
    "disabilityCoverageFlag" BOOLEAN NOT NULL DEFAULT false,
    "umbrellaCoverageFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_assumptions" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "inflationRate" DECIMAL(5,4) NOT NULL DEFAULT 0.03,
    "expectedPortfolioReturn" DECIMAL(5,4) NOT NULL DEFAULT 0.07,
    "expectedPortfolioVolatility" DECIMAL(5,4) NOT NULL DEFAULT 0.12,
    "defaultRetirementAgeOverride" INTEGER,
    "longevityTargetPrimary" INTEGER,
    "longevityTargetSpouse" INTEGER,
    "assumedTaxRate" DECIMAL(5,4),
    "simulationCountDefault" INTEGER DEFAULT 1000,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planning_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_profiles_householdId_key" ON "expense_profiles"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_profiles_householdId_key" ON "insurance_profiles"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "planning_assumptions_householdId_key" ON "planning_assumptions"("householdId");

-- AddForeignKey
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_householdMemberId_fkey" FOREIGN KEY ("householdMemberId") REFERENCES "household_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_accounts" ADD CONSTRAINT "asset_accounts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_accounts" ADD CONSTRAINT "asset_accounts_householdMemberId_fkey" FOREIGN KEY ("householdMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_householdMemberId_fkey" FOREIGN KEY ("householdMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_profiles" ADD CONSTRAINT "expense_profiles_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_sources" ADD CONSTRAINT "benefit_sources_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_sources" ADD CONSTRAINT "benefit_sources_householdMemberId_fkey" FOREIGN KEY ("householdMemberId") REFERENCES "household_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "real_estate_properties" ADD CONSTRAINT "real_estate_properties_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurance_profiles" ADD CONSTRAINT "insurance_profiles_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_assumptions" ADD CONSTRAINT "planning_assumptions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
