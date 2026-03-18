// Structured override payload — stores only changed values
// null = use baseline value; undefined = not in payload at all
export interface MemberTimingOverride {
  memberId: string;
  retirementAgeOverride?: number;     // override retirement target age
  lifeExpectancyOverride?: number;    // override life expectancy
}

export interface ScenarioOverridePayload {
  // Member-level timing
  memberOverrides?: MemberTimingOverride[];

  // Planning assumptions
  inflationRateOverride?: number;           // e.g. 0.035 for 3.5%
  expectedReturnOverride?: number;          // e.g. 0.06
  taxRateOverride?: number;                 // e.g. 0.25

  // Retirement spending
  retirementEssentialOverride?: number;     // annual dollars
  retirementDiscretionaryOverride?: number; // annual dollars
  retirementDiscretionaryPctChange?: number; // e.g. -0.10 for -10%
  healthcareAnnualOverride?: number;
  housingAnnualOverride?: number;

  // Savings / contributions
  additionalAnnualSavings?: number;         // added to first eligible account contribution
  accountContributionOverrides?: Array<{
    accountId: string;
    annualContributionOverride: number;
  }>;

  // Benefits
  benefitClaimAgeOverrides?: Array<{
    benefitId: string;
    claimAgeOverride: number;
  }>;

  // Notes / labels
  notes?: string;
}

// Validation result
export interface OverrideValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Scenario summary for list view
export interface ScenarioSummary {
  id: string;
  name: string;
  description: string | null;
  scenarioType: string;
  status: string;
  isBaseline: boolean;
  createdAt: string;
  updatedAt: string;
  latestRun?: {
    id: string;
    success: boolean;
    firstDepletionYear: number | null;
    endingBalance: string;
    endingNetWorth: string;
    projectionStartYear: number;
    projectionEndYear: number;
    createdAt: string;
  } | null;
}

// Comparison types
export interface ScenarioAssumptionDiff {
  label: string;
  baseline: string;
  scenario: string;
  changed: boolean;
}

export interface ScenarioOutcomeDiff {
  label: string;
  baseline: string | number;
  scenario: string | number;
  delta: string;
  direction: 'better' | 'worse' | 'neutral';
}

export interface ScenarioComparisonResult {
  scenarioA: {
    id: string;
    name: string;
    isBaseline: boolean;
    readinessStatus: string;
    success: boolean;
    firstDepletionYear: number | null;
    endingBalance: number;
    endingNetWorth: number;
    totalWithdrawals: number;
    totalTaxes: number;
    yearsFullyFunded: number;
    yearsProjected: number;
    firstRetirementYear: number | null;
    projectionStartYear: number;
    projectionEndYear: number;
    yearByYear: Array<{ year: number; endingTotalAssets: number; totalIncome: number; expenses: number; actualWithdrawal: number }>;
  };
  scenarioB: {
    id: string;
    name: string;
    isBaseline: boolean;
    readinessStatus: string;
    success: boolean;
    firstDepletionYear: number | null;
    endingBalance: number;
    endingNetWorth: number;
    totalWithdrawals: number;
    totalTaxes: number;
    yearsFullyFunded: number;
    yearsProjected: number;
    firstRetirementYear: number | null;
    projectionStartYear: number;
    projectionEndYear: number;
    yearByYear: Array<{ year: number; endingTotalAssets: number; totalIncome: number; expenses: number; actualWithdrawal: number }>;
  };
  assumptionDiffs: ScenarioAssumptionDiff[];
  outcomeDiffs: ScenarioOutcomeDiff[];
}
