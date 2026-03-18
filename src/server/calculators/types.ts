import type { ProjectionRunSummary } from '@/server/simulation/types';

export interface RetirementReadinessResult {
  status: 'Strong' | 'Needs Attention' | 'At Risk';
  statusReason: string;
  success: boolean;
  firstDepletionYear: number | null;
  firstRetirementYear: number | null;
  projectionStartYear: number;
  projectionEndYear: number;
  yearsFullyFunded: number;
  yearsProjected: number;
  endingBalance: number;
  endingNetWorth: number;
  totalWithdrawals: number;
  totalTaxes: number;
  summary: ProjectionRunSummary;
}

export interface SavingsGapResult {
  baselineSuccess: boolean;
  firstDepletionYear: number | null;
  additionalAnnualSavingsNeeded: number | null;
  additionalMonthlySavingsNeeded: number | null;
  retirementSpendingReductionNeeded: number | null;
  retirementMonthlySpendingReductionNeeded: number | null;
  searchBoundReached: boolean;
  note: string;
}

export interface RetirementIncomeYear {
  year: number;
  memberAges: Record<string, number>;
  earnedIncome: number;
  benefitsIncome: number;
  withdrawals: number;
  totalIncome: number;
  expenses: number;
  surplus: number;
}

export interface RetirementIncomeProjectionResult {
  allYears: RetirementIncomeYear[];
  retirementYears: RetirementIncomeYear[];
  preRetirementYears: RetirementIncomeYear[];
  firstRetirementYear: number | null;
  averageAnnualRetirementIncome: number;
  averageAnnualRetirementWithdrawals: number;
  yearsWithShortfall: number;
  totalRetirementIncome: number;
  totalRetirementWithdrawals: number;
}

export interface WithdrawalCalculatorResult {
  plannedAnnualWithdrawal: number;
  currentPlanDepletes: boolean;
  currentPlanFirstDepletionYear: number | null;
  sustainableAnnualWithdrawal: number | null;
  sustainableMonthlyWithdrawal: number | null;
  withdrawalDifference: number | null;
  searchBoundReached: boolean;
  note: string;
}

export interface MemberRetirementSummary {
  memberId: string;
  firstName: string;
  currentAge: number;
  retirementTargetAge: number;
  yearsUntilRetirement: number;
  retirementYear: number;
  alreadyRetired: boolean;
}

export interface YearsUntilRetirementResult {
  members: MemberRetirementSummary[];
  householdRetirementYear: number;
  yearsUntilHouseholdRetirement: number;
  projectedAssetsAtRetirement: number;
  projectedAnnualIncomeAtRetirement: number;
  projectedAnnualExpensesAtRetirement: number;
  projectedFundingGapAtRetirement: number;
  primaryMemberRetirementYear: number;
}
