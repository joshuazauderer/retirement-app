import type { SimulationSnapshot, DeterministicProjectionResult, ProjectionYearState } from '@/server/simulation/types';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import type { RetirementIncomeProjectionResult, RetirementIncomeYear } from './types';

export function computeRetirementIncomeProjection(
  snapshot: SimulationSnapshot,
  projectionResult?: DeterministicProjectionResult
): RetirementIncomeProjectionResult {
  const result = projectionResult ?? runDeterministicProjection(snapshot);
  const { yearByYear, summary } = result;

  const toYear = (y: ProjectionYearState): RetirementIncomeYear => ({
    year: y.year,
    memberAges: y.memberAges,
    earnedIncome: y.earnedIncome,
    benefitsIncome: y.benefitsIncome,
    withdrawals: y.actualWithdrawal,
    totalIncome: y.earnedIncome + y.benefitsIncome + y.actualWithdrawal,
    expenses: y.expenses + y.liabilityPayments + y.taxes,
    surplus: (y.earnedIncome + y.benefitsIncome + y.actualWithdrawal) - (y.expenses + y.liabilityPayments + y.taxes),
  });

  const allYears = yearByYear.map(toYear);
  const firstRetirementYear = summary.firstRetirementYear;
  const retirementYears = firstRetirementYear ? allYears.filter(y => y.year >= firstRetirementYear) : [];
  const preRetirementYears = firstRetirementYear ? allYears.filter(y => y.year < firstRetirementYear) : allYears;

  const avg = (arr: RetirementIncomeYear[], fn: (y: RetirementIncomeYear) => number) =>
    arr.length > 0 ? arr.reduce((s, y) => s + fn(y), 0) / arr.length : 0;

  return {
    allYears,
    retirementYears,
    preRetirementYears,
    firstRetirementYear,
    averageAnnualRetirementIncome: avg(retirementYears, y => y.totalIncome),
    averageAnnualRetirementWithdrawals: avg(retirementYears, y => y.withdrawals),
    yearsWithShortfall: allYears.filter(y => y.surplus < 0).length,
    totalRetirementIncome: retirementYears.reduce((s, y) => s + y.totalIncome, 0),
    totalRetirementWithdrawals: retirementYears.reduce((s, y) => s + y.withdrawals, 0),
  };
}
