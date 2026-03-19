/**
 * validationService — centralized Zod-based input validation schemas.
 *
 * All API route inputs are validated here before processing.
 * Schemas are reusable and centralized — not duplicated in routes.
 *
 * Usage in API routes:
 *   const body = ValidationSchemas.TaxPlanningInput.parse(await req.json());
 *   // throws ZodError on failure → caught by handleApiError
 */

import { z } from 'zod';

// --- Primitives ---
const HouseholdId = z.string().cuid({ message: 'Invalid householdId format' });
const ScenarioId = z.string().cuid({ message: 'Invalid scenarioId format' });
const RunId = z.string().cuid({ message: 'Invalid runId format' });
const Email = z.string().email({ message: 'Invalid email address' }).max(255);
const Label = z.string().min(1, 'Label is required').max(200, 'Label too long').trim();
const PositiveNumber = z.number().nonnegative('Must be a non-negative number');
const Rate = z.number().min(0).max(1, 'Rate must be between 0 and 1');
const Year = z.number().int().min(1900).max(2200);
const Age = z.number().int().min(18).max(120);

// --- Tax Planning ---
const RothConversionConfig = z.object({
  enabled: z.boolean(),
  annualAmount: PositiveNumber,
  startYear: Year,
  endYear: Year.optional(),
  inflationAdjust: z.boolean().optional(),
}).optional();

export const TaxPlanningInputSchema = z.object({
  householdId: HouseholdId,
  scenarioId: ScenarioId,
  label: Label,
  filingStatus: z.enum(['SINGLE', 'MARRIED_FILING_JOINTLY', 'HEAD_OF_HOUSEHOLD', 'MARRIED_FILING_SEPARATELY']),
  stateCode: z.string().length(2).toUpperCase(),
  withdrawalOrderPreference: z.enum(['TAX_DEFERRED_FIRST', 'TAX_FREE_FIRST', 'PRO_RATA', 'OPTIMAL']).optional(),
  capitalGainsBasisRatio: z.number().min(0).max(1).optional(),
  rothConversion: RothConversionConfig,
});

// --- Healthcare Planning ---
export const HealthcarePlanningInputSchema = z.object({
  householdId: HouseholdId,
  scenarioId: ScenarioId,
  label: Label,
  preMedicare: z.object({
    annualPremium: PositiveNumber,
    annualOutOfPocket: PositiveNumber,
  }),
  medicareEligibilityAge: Age.min(60).max(70),
  medicare: z.object({
    includePartB: z.boolean(),
    includePartD: z.boolean(),
    includeMedigapOrAdvantage: z.boolean(),
    additionalAnnualOOP: PositiveNumber,
  }),
  healthcareInflationRate: z.number().min(0).max(0.20),
  ltcStress: z.object({
    enabled: z.boolean(),
    startAge: Age,
    durationYears: z.number().int().min(1).max(30),
    annualCost: PositiveNumber,
  }),
  longevityStress: z.object({
    enabled: z.boolean(),
    targetAge: Age.min(80).max(110),
    person: z.enum(['primary', 'spouse', 'both']),
  }),
  includeSpouseHealthcare: z.boolean(),
});

// --- Housing Planning ---
export const HousingPlanningInputSchema = z.object({
  householdId: HouseholdId,
  scenarioId: ScenarioId,
  label: Label,
  housing: z.object({
    strategy: z.enum(['STAY_IN_PLACE', 'DOWNSIZE', 'RELOCATE', 'DOWNSIZE_AND_RELOCATE']),
    currentHomeValue: PositiveNumber,
    currentMortgageBalance: PositiveNumber,
    currentAnnualHousingCost: PositiveNumber,
    currentMortgageAnnualPayment: PositiveNumber,
    mortgagePayoffYear: Year.optional(),
    annualHomeAppreciationRate: Rate,
  }),
  downsizing: z.object({
    enabled: z.boolean(),
    saleYear: Year,
    expectedSalePrice: PositiveNumber,
    sellingCostPercent: z.number().min(0).max(0.20),
    buyingReplacementHome: z.boolean(),
    replacementHomePurchasePrice: PositiveNumber,
    replacementHomeMortgageAmount: PositiveNumber,
    replacementHomeMortgageAnnualPayment: PositiveNumber,
    replacementHomeMortgagePayoffYear: Year.optional(),
    postMoveAnnualHousingCost: PositiveNumber,
    oneTimeMoveExpense: PositiveNumber,
  }),
  relocation: z.object({
    enabled: z.boolean(),
    relocationYear: Year,
    newStateCode: z.string().length(2).toUpperCase(),
    newAnnualHousingCost: PositiveNumber,
    oneTimeMoveExpense: PositiveNumber,
    sellCurrentHome: z.boolean(),
    expectedSalePrice: PositiveNumber.optional(),
    sellingCostPercent: z.number().min(0).max(0.20).optional(),
  }),
  gifting: z.object({
    enabled: z.boolean(),
    annualGiftAmount: PositiveNumber,
    giftStartYear: Year,
    giftEndYear: Year.optional(),
  }),
  includeRealEstateInLegacy: z.boolean(),
});

// --- Copilot / Conversation ---
export const CopilotRequestSchema = z.object({
  householdId: HouseholdId,
  message: z.string().min(1, 'Message required').max(2000, 'Message too long').trim(),
  sessionId: z.string().cuid().optional(),
  context: z.object({
    activeScenarioId: ScenarioId.optional(),
  }).optional(),
});

// --- AI Insight ---
export const AiInsightRequestSchema = z.object({
  householdId: HouseholdId,
  runId: RunId,
  scenarioName: z.string().min(1).max(200),
  insightType: z.enum(['PLAN_SUMMARY', 'RISK_DETECTION', 'SCENARIO_COMPARISON', 'RECOMMENDATION', 'TAX_EXPLANATION', 'HEALTHCARE_EXPLANATION', 'HOUSING_LEGACY_EXPLANATION']),
  success: z.boolean(),
  firstDepletionYear: Year.optional().nullable(),
  projectionStartYear: Year,
  projectionEndYear: Year,
  endingAssets: z.number(),
  yearsFunded: z.number().int().min(0),
  withdrawalRate: Rate.optional(),
  totalTaxes: PositiveNumber.optional(),
  totalHealthcareCost: PositiveNumber.optional(),
  netEstateValue: PositiveNumber.optional(),
  primaryAge: Age,
  risks: z.object({
    earlyDepletionRisk: z.boolean(),
    sequenceRisk: z.boolean(),
    longevityRisk: z.boolean(),
    taxInefficiencyRisk: z.boolean(),
    healthcareRisk: z.boolean(),
    concentrationRisk: z.boolean(),
  }),
  deltas: z.object({
    endingAssetsDelta: z.number().optional(),
    firstDepletionYearDelta: z.number().optional(),
    totalTaxDelta: z.number().optional(),
    totalHealthcareDelta: z.number().optional(),
    netEstateValueDelta: z.number().optional(),
  }).optional(),
  rothConversionEnabled: z.boolean().optional(),
  hasLtcStress: z.boolean().optional(),
  hasLongevityStress: z.boolean().optional(),
  longevityTargetAge: Age.optional(),
  housingStrategy: z.string().optional(),
  filingStatus: z.string().optional(),
  stateCode: z.string().length(2).optional(),
});

// --- Collaboration ---
export const InviteUserSchema = z.object({
  householdId: HouseholdId,
  email: Email,
  role: z.enum(['COLLABORATOR', 'ADVISOR', 'VIEWER']),
  permissionLevel: z.enum(['VIEW', 'EDIT']).optional(),
});

export const RemoveMemberSchema = z.object({
  householdId: HouseholdId,
  targetUserId: z.string().cuid(),
});

export const RevokeInviteSchema = z.object({
  invitationId: z.string().cuid(),
  householdId: HouseholdId,
});

// --- Report ---
export const ReportRequestSchema = z.object({
  householdId: HouseholdId,
  reportType: z.enum(['HOUSEHOLD_SUMMARY', 'SCENARIO_SUMMARY', 'SCENARIO_COMPARISON', 'MONTE_CARLO_SUMMARY', 'TAX_PLANNING', 'HEALTHCARE_LONGEVITY', 'HOUSING_LEGACY']),
  sourceRunId: RunId.optional(),
  secondaryRunId: RunId.optional(),
  exportFormat: z.enum(['PDF', 'CSV', 'PRINT']).optional(),
  label: Label.optional(),
});

// --- Generic helpers ---
export const HouseholdIdQuerySchema = z.object({
  householdId: HouseholdId,
});

export const RunIdParamsSchema = z.object({
  runId: RunId,
});

/**
 * Safe parse helper — returns { success, data, error } instead of throwing.
 */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  // Zod v4 uses .issues; Zod v3 used .errors — support both
  const issues = (result.error as unknown as { issues?: Array<{ path: (string | number)[]; message: string }> }).issues
    ?? (result.error as unknown as { errors?: Array<{ path: (string | number)[]; message: string }> }).errors
    ?? [];
  const firstIssue = issues[0];
  return { success: false, error: firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validation failed' };
}
