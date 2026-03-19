/**
 * Phase 8 — Social Security Modeling + Couple Coordination + Survivor Income
 *
 * Centralized types for SS claim-age adjustment, COLA, couple coordination,
 * and survivor benefit logic.
 *
 * v1 Limitations:
 * - Planning-grade adjustments only (not SSA-exact)
 * - FRA fixed at 67 (born 1960+) — does not vary by birth year cohort
 * - Annual time-step model (not monthly)
 * - No Windfall Elimination Provision (WEP) or Government Pension Offset (GPO)
 * - No deemed filing, file-and-suspend, or restricted application strategies
 * - No spousal benefit (50% of higher earner's PIA)
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface SocialSecurityInput {
  householdId: string;
  scenarioId: string;
  label?: string;
  /**
   * Per-member claim age overrides.
   * Key: memberId. Value: claim age (integer, 62–70).
   * When omitted for a member, falls back to the claimAge stored in BenefitSource.
   */
  claimAgeOverrides?: Record<string, number>;
  /**
   * Fraction of couple retirement expenses the survivor is assumed to need.
   * Default: SS_BOUNDS.DEFAULT_SURVIVOR_EXPENSE_RATIO (0.80).
   * Only relevant for COUPLE planning mode.
   */
  survivorExpenseRatio?: number;
}

// ---------------------------------------------------------------------------
// Per-year result types
// ---------------------------------------------------------------------------

export interface SocialSecurityYearResult {
  year: number;
  memberId: string;
  age: number;
  alive: boolean;
  hasClaimed: boolean;
  /** Annual benefit this year (post-COLA, post-adjustment). 0 if not yet claimed or deceased. */
  annualBenefit: number;
  /**
   * Survivor benefit available to this member if the other member has already died.
   * 0 if not in survivor phase or not the surviving member.
   */
  survivorBenefit: number;
  /**
   * What the member actually receives this year.
   * = max(annualBenefit, survivorBenefit) while alive; 0 after death.
   */
  effectiveBenefit: number;
}

export interface SocialSecurityHouseholdYearResult {
  year: number;
  memberResults: SocialSecurityYearResult[];
  /** Sum of effectiveBenefit across all alive members. */
  totalHouseholdBenefit: number;
  /** True from the year the first member dies onward. */
  isSurvivorPhase: boolean;
  /** Projected couple/household expenses in this year (inflation-adjusted). */
  projectedExpenses: number;
  /** Projected expenses if in survivor phase. */
  survivorExpenses: number;
}

// ---------------------------------------------------------------------------
// Member summary types
// ---------------------------------------------------------------------------

export interface SocialSecurityMemberSummary {
  memberId: string;
  firstName: string;
  /** Full Retirement Age (from SS_BOUNDS.FULL_RETIREMENT_AGE — centralized). */
  fra: number;
  /** Claim age used for this analysis run. */
  claimAge: number;
  /** Annual benefit at FRA (back-calculated from the stored benefit at stored claimAge). */
  fraEquivalentAnnualBenefit: number;
  /** Annual benefit after claim-age adjustment. */
  adjustedAnnualBenefit: number;
  /** Adjustment multiplier (e.g., 0.80 for ~60 months early; 1.24 for 36 months late). */
  adjustmentFactor: number;
  /**
   * Break-even age vs. claiming at FRA.
   * Null if claimAge === FRA, or if break-even is beyond age 100.
   */
  breakEvenAgeVsFRA: number | null;
  /** Total lifetime SS income for this member (sum of effectiveBenefit across all years). */
  totalLifetimeBenefit: number;
  yearlyResults: SocialSecurityYearResult[];
}

// ---------------------------------------------------------------------------
// Survivor types
// ---------------------------------------------------------------------------

export interface SurvivorTransitionResult {
  deceasedMemberId: string;
  survivingMemberId: string;
  /** Calendar year in which the first member dies (per life expectancy). */
  transitionYear: number;
  /** The deceased member's SS benefit at the year of death (post-COLA). */
  deceasedBenefitAtDeath: number;
  /** The surviving member's own SS benefit at the year of death (post-COLA). */
  survivingOwnBenefit: number;
  /**
   * Survivor benefit: the higher of the two SS streams.
   * Surviving spouse retains whichever is larger.
   */
  survivorBenefit: number;
  /** Fraction of couple expenses the survivor is assumed to need (e.g. 0.80). */
  survivorExpenseRatio: number;
  /** Couple's inflation-adjusted annual retirement expenses at the transition year. */
  coupleAnnualExpensesAtTransition: number;
  /** Estimated annual expenses in survivor phase (coupleExpenses × survivorExpenseRatio). */
  projectedAnnualSurvivorExpenses: number;
  /** Estimated annual SS income in survivor phase (survivorBenefit, post-COLA). */
  projectedAnnualSurvivorIncome: number;
  /**
   * Annual income gap in survivor phase.
   * Positive = shortfall (expenses exceed SS income); negative = surplus.
   */
  annualGapAfterTransition: number;
}

// ---------------------------------------------------------------------------
// Couple coordination types
// ---------------------------------------------------------------------------

export interface CoupleRetirementCoordinationResult {
  primaryMemberId: string;
  spouseMemberId: string;
  primaryRetirementYear: number;
  spouseRetirementYear: number;
  primaryClaimYear: number;
  spouseClaimYear: number;
  /** Number of projection years where both members are alive and receiving SS. */
  yearsWithBothBenefits: number;
  /** Number of projection years after the first member's death. */
  yearsInSurvivorPhase: number;
  /** Calendar year in which the first member dies. Null if projection ends before either death. */
  firstDeathYear: number | null;
}

// ---------------------------------------------------------------------------
// Run result types
// ---------------------------------------------------------------------------

export interface SocialSecurityPlanningRunResult {
  runId: string;
  householdId: string;
  scenarioId: string;
  scenarioName: string;
  label: string;
  createdAt: string;
  memberSummaries: SocialSecurityMemberSummary[];
  /** Couple coordination details. Null for single-member households. */
  coupleCoordination: CoupleRetirementCoordinationResult | null;
  /** Survivor transition details. Null for single-member households. */
  survivorTransition: SurvivorTransitionResult | null;
  /** Total SS income across all members across all projection years. */
  totalHouseholdLifetimeBenefit: number;
  yearByYear: SocialSecurityHouseholdYearResult[];
  projectionStartYear: number;
  projectionEndYear: number;
}

export interface SocialSecurityRunSummaryItem {
  runId: string;
  label: string;
  scenarioName: string;
  /** Map of memberId → claimAge for quick display. */
  claimAges: Record<string, number>;
  totalLifetimeBenefit: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Comparison types
// ---------------------------------------------------------------------------

export interface SocialSecurityClaimComparisonResult {
  runA: SocialSecurityPlanningRunResult;
  runB: SocialSecurityPlanningRunResult;
  claimAgeDiffs: Array<{
    memberId: string;
    firstName: string;
    claimAgeA: number;
    claimAgeB: number;
    adjustmentFactorA: number;
    adjustmentFactorB: number;
  }>;
  outcomeDiffs: Array<{
    label: string;
    a: string;
    b: string;
    delta: string;
    direction: 'better' | 'worse' | 'neutral';
  }>;
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

export interface SocialSecurityValidation {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Bounds / defaults — single source of truth
// ---------------------------------------------------------------------------

export const SS_BOUNDS = {
  /**
   * Full Retirement Age for those born 1960 or later.
   * All services import this constant via getFullRetirementAge() in
   * claimingAdjustmentService.ts. Never hard-code 67 elsewhere.
   */
  FULL_RETIREMENT_AGE: 67,
  MIN_CLAIM_AGE: 62,
  MAX_CLAIM_AGE: 70,
  /**
   * Early claiming reduction: 5/9 of 1% per month for the first 36 months
   * before FRA (≈ 0.5556%/month).
   */
  EARLY_REDUCTION_RATE_FIRST_36: (5 / 9) * 0.01,
  /**
   * Early claiming reduction: 5/12 of 1% per month for each month beyond 36
   * before FRA (≈ 0.4167%/month). Applies to claimAge < 64 when FRA = 67.
   */
  EARLY_REDUCTION_RATE_BEYOND_36: (5 / 12) * 0.01,
  /**
   * Delayed retirement credit: 2/3 of 1% per month for each month after FRA,
   * up to age 70 (≈ 0.6667%/month, 8%/year).
   */
  DELAYED_CREDIT_RATE_PER_MONTH: (2 / 3) * 0.01,
  /** Default fraction of couple retirement expenses that continue in survivor phase. */
  DEFAULT_SURVIVOR_EXPENSE_RATIO: 0.80,
  ENGINE_VERSION: '1.0.0',
} as const;
