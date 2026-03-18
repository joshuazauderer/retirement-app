export interface SimulationSnapshot {
  metadata: {
    engineVersion: string;
    snapshotGeneratedAt: string;
    householdId: string;
    scenarioLabel: string;
  };
  timeline: {
    simulationYearStart: number;
    projectionEndYear: number;
  };
  household: {
    householdId: string;
    planningMode: "INDIVIDUAL" | "COUPLE";
    filingStatus: string;
    stateOfResidence: string;
  };
  members: NormalizedMember[];
  incomeSources: NormalizedIncomeSource[];
  assetAccounts: NormalizedAssetAccount[];
  liabilities: NormalizedLiability[];
  expenseProfile: NormalizedExpenseProfile;
  benefitSources: NormalizedBenefitSource[];
  planningAssumptions: NormalizedPlanningAssumptions;
}

export interface NormalizedMember {
  memberId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  currentAge: number;
  retirementTargetAge: number;
  lifeExpectancy: number;
  isPrimary: boolean;
}

export interface NormalizedIncomeSource {
  id: string;
  memberId: string | null;
  type: string;
  label: string;
  annualAmount: number; // already annualized
  growthRate: number; // decimal, e.g. 0.03
  taxable: boolean;
  startYear: number | null;
  endYear: number | null;
  isPostRetirementIncome: boolean; // true only for RENTAL, BUSINESS, PART_TIME, OTHER
}

export interface NormalizedAssetAccount {
  id: string;
  memberId: string | null;
  ownerType: string;
  taxTreatment: "TAXABLE" | "TAX_DEFERRED" | "TAX_FREE" | "MIXED";
  accountName: string;
  currentBalance: number;
  annualContribution: number; // annualized
  expectedReturnRate: number; // decimal
  isRetirementAccount: boolean;
}

export interface NormalizedLiability {
  id: string;
  type: string;
  label: string;
  currentBalance: number;
  interestRate: number;
  annualPayment: number;
  payoffYear: number | null;
}

export interface NormalizedExpenseProfile {
  currentAnnualSpending: number;
  retirementEssential: number;
  retirementDiscretionary: number;
  healthcareAnnual: number;
  housingAnnual: number;
  inflationRate: number;
}

export interface NormalizedBenefitSource {
  id: string;
  memberId: string | null;
  type: string;
  label: string;
  annualBenefit: number; // annualized from monthly
  claimAge: number | null;
  startYear: number | null;
  colaRate: number; // decimal
  taxable: boolean;
  survivorEligible: boolean;
}

export interface NormalizedPlanningAssumptions {
  inflationRate: number;
  expectedPortfolioReturn: number;
  assumedEffectiveTaxRate: number;
  longevityTargets: Record<string, number>; // memberId -> age
  retirementAgeOverrides: Record<string, number>; // memberId -> age
}

// Engine outputs
export interface ProjectionYearState {
  year: number;
  memberAges: Record<string, number>; // memberId -> age
  memberAlive: Record<string, boolean>; // memberId -> alive
  memberRetired: Record<string, boolean>; // memberId -> retired
  beginningTotalAssets: number;
  earnedIncome: number;
  benefitsIncome: number;
  totalIncome: number;
  expenses: number;
  liabilityPayments: number;
  taxes: number;
  contributions: number;
  /** Needs-based cash-flow gap (what's required to cover expenses). Always computed. */
  requiredWithdrawal: number;
  /**
   * Phase 7: The withdrawal target from the policy engine.
   * Only set when a withdrawalPolicy is injected; undefined otherwise (use requiredWithdrawal).
   */
  policyWithdrawalTarget?: number;
  /** Phase 7: Guardrail adjustment direction for this year (undefined when no policy). */
  guardrailDirection?: 'none' | 'reduced' | 'increased';
  withdrawalsByBucket: { taxable: number; taxDeferred: number; taxFree: number };
  /** Phase 7: Per-account gross withdrawal amounts. */
  withdrawalsByAccount?: Record<string, number>;
  actualWithdrawal: number;
  shortfall: number;
  investmentGrowth: number;
  endingTotalAssets: number;
  endingAccountBalances: Record<string, number>; // accountId -> balance
  endingLiabilityBalances: Record<string, number>; // liabilityId -> balance
  netWorth: number;
  depleted: boolean;
}

export interface ProjectionRunSummary {
  householdId: string;
  runType: string;
  projectionStartYear: number;
  projectionEndYear: number;
  yearsProjected: number;
  success: boolean;
  firstRetirementYear: number | null;
  firstDepletionYear: number | null;
  endingBalance: number;
  endingNetWorth: number;
  totalWithdrawals: number;
  totalTaxes: number;
  totalShortfall: number;
}

export interface DeterministicProjectionResult {
  snapshot: SimulationSnapshot;
  yearByYear: ProjectionYearState[];
  summary: ProjectionRunSummary;
}
