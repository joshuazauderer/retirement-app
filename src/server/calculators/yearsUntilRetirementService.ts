import type { SimulationSnapshot, DeterministicProjectionResult } from '@/server/simulation/types';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import type { YearsUntilRetirementResult, MemberRetirementSummary } from './types';

export function computeYearsUntilRetirement(
  snapshot: SimulationSnapshot,
  projectionResult?: DeterministicProjectionResult
): YearsUntilRetirementResult {
  const result = projectionResult ?? runDeterministicProjection(snapshot);
  const { yearByYear, summary } = result;
  const currentYear = snapshot.timeline.simulationYearStart;

  const memberSummaries: MemberRetirementSummary[] = snapshot.members.map(m => {
    const birthYear = parseInt(m.dateOfBirth.slice(0, 4), 10);
    const retirementYear = birthYear + m.retirementTargetAge;
    const yearsUntil = retirementYear - currentYear;
    return {
      memberId: m.memberId,
      firstName: m.firstName,
      currentAge: m.currentAge,
      retirementTargetAge: m.retirementTargetAge,
      yearsUntilRetirement: Math.max(0, yearsUntil),
      retirementYear,
      alreadyRetired: yearsUntil <= 0,
    };
  });

  const householdRetirementYear = Math.max(...memberSummaries.map(m => m.retirementYear));
  const yearsUntilHouseholdRetirement = Math.max(0, householdRetirementYear - currentYear);

  const retirementYearState = yearByYear.find(y => y.year >= householdRetirementYear);
  const projectedAssetsAtRetirement = retirementYearState?.beginningTotalAssets ?? 0;
  const projectedAnnualIncomeAtRetirement = retirementYearState
    ? retirementYearState.earnedIncome + retirementYearState.benefitsIncome
    : 0;
  const projectedAnnualExpensesAtRetirement = retirementYearState?.expenses ?? 0;
  const projectedFundingGapAtRetirement = projectedAnnualIncomeAtRetirement - projectedAnnualExpensesAtRetirement;

  const primaryMember = memberSummaries.find(ms => {
    const snap = snapshot.members.find(sm => sm.memberId === ms.memberId);
    return snap?.isPrimary;
  }) ?? memberSummaries[0];

  return {
    members: memberSummaries,
    householdRetirementYear,
    yearsUntilHouseholdRetirement,
    projectedAssetsAtRetirement,
    projectedAnnualIncomeAtRetirement,
    projectedAnnualExpensesAtRetirement,
    projectedFundingGapAtRetirement,
    primaryMemberRetirementYear: primaryMember?.retirementYear ?? currentYear,
  };
}
