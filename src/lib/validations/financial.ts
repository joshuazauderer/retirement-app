import { z } from "zod";

const decimalString = z
  .string()
  .refine(
    (val) => !isNaN(Number(val)) && Number(val) >= 0,
    "Must be a non-negative number"
  );

// Converts NaN (from empty <input type="number" valueAsNumber>) → undefined
// so optional number fields don't silently fail Zod validation.
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (v) => (typeof v === "number" && isNaN(v) ? undefined : v),
    schema.optional()
  );

export const incomeSourceSchema = z.object({
  householdMemberId: z.string().min(1, "Member is required"),
  type: z.enum(["SALARY", "BONUS", "PENSION", "RENTAL", "BUSINESS", "PART_TIME", "OTHER"]),
  label: z.string().min(1, "Label is required").max(100),
  amount: decimalString,
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  annualGrowthRate: z.string().optional(),
  taxable: z.boolean().default(true),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const assetAccountSchema = z.object({
  householdMemberId: z.string().optional(),
  ownerType: z.enum(["INDIVIDUAL", "JOINT", "HOUSEHOLD"]),
  type: z.enum([
    "CHECKING",
    "SAVINGS",
    "BROKERAGE",
    "TRADITIONAL_401K",
    "ROTH_401K",
    "TRADITIONAL_IRA",
    "ROTH_IRA",
    "HSA",
    "ANNUITY",
    "CASH",
    "CD",
    "OTHER",
  ]),
  institutionName: z.string().optional(),
  accountName: z.string().min(1, "Account name is required").max(100),
  currentBalance: decimalString,
  annualContributionAmount: z.string().optional(),
  contributionFrequency: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"]).optional()
  ),
  employerMatchAmount: z.string().optional(),
  employerMatchPercent: z.string().optional(),
  taxTreatment: z.enum(["TAXABLE", "TAX_DEFERRED", "TAX_FREE", "MIXED"]),
  expectedReturnRate: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const liabilitySchema = z.object({
  householdMemberId: z.string().optional(),
  type: z.enum([
    "MORTGAGE",
    "AUTO_LOAN",
    "STUDENT_LOAN",
    "CREDIT_CARD",
    "PERSONAL_LOAN",
    "HELOC",
    "OTHER",
  ]),
  label: z.string().min(1, "Label is required").max(100),
  lenderName: z.string().optional(),
  currentBalance: decimalString,
  interestRate: z.string().optional(),
  monthlyPayment: z.string().optional(),
  payoffDate: z.string().optional(),
  isSecured: z.boolean().default(false),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const expenseProfileSchema = z.object({
  currentMonthlySpending: decimalString,
  retirementMonthlyEssential: decimalString,
  retirementMonthlyDiscretionary: decimalString,
  healthcareMonthlyEstimate: decimalString,
  housingMonthlyEstimate: decimalString,
  travelMonthlyEstimate: z.string().optional(),
  otherMonthlyEstimate: z.string().optional(),
  inflationAssumption: z.string().optional(),
  notes: z.string().optional(),
});

export const benefitSourceSchema = z.object({
  householdMemberId: z.string().min(1, "Member is required"),
  type: z.enum([
    "SOCIAL_SECURITY",
    "PENSION",
    "ANNUITY_INCOME",
    "VETERANS_BENEFIT",
    "DISABILITY",
    "OTHER",
  ]),
  label: z.string().min(1, "Label is required").max(100),
  estimatedMonthlyBenefit: decimalString,
  claimAge: z.number().min(50).max(80),
  startDate: z.string().optional(),
  colaRate: z.string().optional(),
  survivorEligible: z.boolean().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const realEstatePropertySchema = z.object({
  type: z.enum([
    "PRIMARY_RESIDENCE",
    "VACATION_HOME",
    "RENTAL_PROPERTY",
    "LAND",
    "OTHER",
  ]),
  label: z.string().min(1, "Label is required").max(100),
  ownershipType: z.enum(["INDIVIDUAL", "JOINT", "HOUSEHOLD"]),
  currentMarketValue: decimalString,
  mortgageBalance: z.string().optional(),
  monthlyMortgagePayment: z.string().optional(),
  annualPropertyTax: z.string().optional(),
  annualInsuranceCost: z.string().optional(),
  annualMaintenanceEstimate: z.string().optional(),
  isPrimaryResidence: z.boolean().default(false),
  downsizingCandidate: z.boolean().default(false),
  expectedSaleYear: optionalNumber(z.number().min(2024).max(2100)),
  notes: z.string().optional(),
});

export const insuranceProfileSchema = z.object({
  healthInsuranceStatus: z
    .string()
    .min(1, "Health insurance status is required"),
  longTermCareCoverage: z.boolean().default(false),
  lifeInsuranceCoverageAmount: z.string().optional(),
  lifeInsuranceNotes: z.string().optional(),
  disabilityCoverageFlag: z.boolean().default(false),
  umbrellaCoverageFlag: z.boolean().default(false),
  notes: z.string().optional(),
});

export const planningAssumptionsSchema = z.object({
  inflationRate: z.number().min(0).max(0.2),
  expectedPortfolioReturn: z.number().min(0).max(0.3),
  expectedPortfolioVolatility: z.number().min(0).max(0.5),
  defaultRetirementAgeOverride: optionalNumber(z.number().min(50).max(80)),
  longevityTargetPrimary: optionalNumber(z.number().min(60).max(120)),
  longevityTargetSpouse: optionalNumber(z.number().min(60).max(120)),
  assumedTaxRate: optionalNumber(z.number().min(0).max(0.6)),
  simulationCountDefault: optionalNumber(z.number().min(100).max(10000)),
  notes: z.string().optional(),
});

export type IncomeSourceInput = z.infer<typeof incomeSourceSchema>;
export type AssetAccountInput = z.infer<typeof assetAccountSchema>;
export type LiabilityInput = z.infer<typeof liabilitySchema>;
export type ExpenseProfileInput = z.infer<typeof expenseProfileSchema>;
export type BenefitSourceInput = z.infer<typeof benefitSourceSchema>;
export type RealEstatePropertyInput = z.infer<typeof realEstatePropertySchema>;
export type InsuranceProfileInput = z.infer<typeof insuranceProfileSchema>;
export type PlanningAssumptionsInput = z.infer<typeof planningAssumptionsSchema>;
