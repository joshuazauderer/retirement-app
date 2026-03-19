/**
 * Couple Coordination Service — Phase 8
 *
 * Projects SS benefits for both members of a couple, handling:
 * - Staggered retirement ages and claim ages
 * - Both-alive phase (both members receiving SS)
 * - Survivor phase (one member deceased; surviving spouse retains higher benefit)
 *
 * This service is called by socialSecurityService.ts and does not persist data.
 */

import type {
  SocialSecurityYearResult,
  SocialSecurityHouseholdYearResult,
  CoupleRetirementCoordinationResult,
  SurvivorTransitionResult,
} from './types';
import { computeSurvivorBenefit, computeSurvivorExpenses, computeSurvivorIncomeGap, applyColaBenefit } from './survivorBenefitService';
import { getMemberAgeAtYear } from '../simulation/normalizeInputs';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface MemberBenefitConfig {
  memberId: string;
  firstName: string;
  dateOfBirth: string;    // ISO string
  lifeExpectancy: number;
  retirementTargetAge: number;
  claimAge: number;
  adjustedAnnualBenefit: number;  // benefit in the year of first claim (no COLA yet)
  colaRate: number;
}

interface AnnualExpenseConfig {
  coupleBaseExpenses: number;    // couple's total annual retirement expenses in year 0 (today's dollars)
  inflationRate: number;
  simulationYearStart: number;
  survivorExpenseRatio: number;
}

// ---------------------------------------------------------------------------
// Couple coordination computation
// ---------------------------------------------------------------------------

/**
 * Project year-by-year SS household results for a couple, handling staggered
 * claim ages and the survivor phase.
 *
 * Key behavioral note — survivor benefit computation:
 * In the year a member dies (alive=false), their rawBenefit drops to 0.
 * The survivor benefit rule must therefore use the member's benefit from the
 * PREVIOUS year (last year alive), not the current death year. We track
 * lastPrimaryBenefitWhileAlive and lastSpouseBenefitWhileAlive for this purpose.
 */
export function projectCoupleSocialSecurity(
  primary: MemberBenefitConfig,
  spouse: MemberBenefitConfig,
  expenseConfig: AnnualExpenseConfig,
  projectionStartYear: number,
  projectionEndYear: number,
): {
  yearByYear: SocialSecurityHouseholdYearResult[];
  coordination: CoupleRetirementCoordinationResult;
  survivorTransition: SurvivorTransitionResult | null;
} {
  const yearByYear: SocialSecurityHouseholdYearResult[] = [];

  // Track claim start years (set once)
  let primaryClaimStartYear: number | null = null;
  let spouseClaimStartYear: number | null = null;

  // Track survivor phase
  let firstDeathYear: number | null = null;
  let deceasedId: string | null = null;
  let survivorId: string | null = null;

  // Survivor benefit frozen at the year of first death (set once)
  let survivorBenefitFixed: number | null = null;

  // Track the last benefit each member received while alive.
  // In the death year rawBenefit = 0 because alive=false. The survivor benefit
  // rule uses the benefit from the last year the member was alive.
  let lastPrimaryBenefitWhileAlive = 0;
  let lastSpouseBenefitWhileAlive = 0;

  // For coordination summary
  let primaryRetirementYear: number | null = null;
  let spouseRetirementYear: number | null = null;
  let yearsWithBothBenefits = 0;
  let yearsInSurvivorPhase = 0;

  // Survivor transition data
  let survivorTransition: SurvivorTransitionResult | null = null;

  for (let year = projectionStartYear; year <= projectionEndYear; year++) {
    const primaryAge = getMemberAgeAtYear(primary.dateOfBirth, year);
    const spouseAge = getMemberAgeAtYear(spouse.dateOfBirth, year);

    const primaryAlive = primaryAge <= primary.lifeExpectancy;
    const spouseAlive = spouseAge <= spouse.lifeExpectancy;

    if (!primaryAlive && !spouseAlive) break;

    // Track first retirement year
    if (primaryAge >= primary.retirementTargetAge && primaryRetirementYear === null) {
      primaryRetirementYear = year;
    }
    if (spouseAge >= spouse.retirementTargetAge && spouseRetirementYear === null) {
      spouseRetirementYear = year;
    }

    // Detect first death (first year a member is no longer alive)
    if (firstDeathYear === null) {
      if (!primaryAlive) {
        firstDeathYear = year;
        deceasedId = primary.memberId;
        survivorId = spouse.memberId;
      } else if (!spouseAlive) {
        firstDeathYear = year;
        deceasedId = spouse.memberId;
        survivorId = primary.memberId;
      }
    }

    const isSurvivorPhase = firstDeathYear !== null;

    // ---- Primary benefit this year ----
    const primaryHasClaimed = primaryAge >= primary.claimAge;
    if (primaryHasClaimed && primaryClaimStartYear === null) {
      primaryClaimStartYear = year;
    }
    const primaryYearsActive = primaryClaimStartYear !== null
      ? year - primaryClaimStartYear
      : 0;
    const primaryRawBenefit = (primaryHasClaimed && primaryAlive)
      ? applyColaBenefit(primary.adjustedAnnualBenefit, primary.colaRate, primaryYearsActive)
      : 0;

    // Update last-alive benefit before using it in survivor logic
    if (primaryAlive && primaryRawBenefit > 0) {
      lastPrimaryBenefitWhileAlive = primaryRawBenefit;
    }

    // ---- Spouse benefit this year ----
    const spouseHasClaimed = spouseAge >= spouse.claimAge;
    if (spouseHasClaimed && spouseClaimStartYear === null) {
      spouseClaimStartYear = year;
    }
    const spouseYearsActive = spouseClaimStartYear !== null
      ? year - spouseClaimStartYear
      : 0;
    const spouseRawBenefit = (spouseHasClaimed && spouseAlive)
      ? applyColaBenefit(spouse.adjustedAnnualBenefit, spouse.colaRate, spouseYearsActive)
      : 0;

    // Update last-alive benefit before using it in survivor logic
    if (spouseAlive && spouseRawBenefit > 0) {
      lastSpouseBenefitWhileAlive = spouseRawBenefit;
    }

    // ---- Survivor phase: freeze survivor benefit at the transition year ----
    // Use the last-alive benefit for the deceased (not the current-year 0).
    if (isSurvivorPhase && survivorBenefitFixed === null && firstDeathYear === year) {
      const deceasedLastBenefit =
        deceasedId === primary.memberId
          ? lastPrimaryBenefitWhileAlive
          : lastSpouseBenefitWhileAlive;
      const survivingCurrentBenefit =
        survivorId === primary.memberId
          ? primaryRawBenefit   // surviving primary is still alive this year
          : spouseRawBenefit;   // surviving spouse is still alive this year

      survivorBenefitFixed = computeSurvivorBenefit(survivingCurrentBenefit, deceasedLastBenefit);

      // Couple expenses at transition year
      const yearsFromStart = year - expenseConfig.simulationYearStart;
      const coupleExpensesAtTransition = expenseConfig.coupleBaseExpenses *
        Math.pow(1 + expenseConfig.inflationRate, yearsFromStart);
      const survivorExpenses = computeSurvivorExpenses(
        coupleExpensesAtTransition,
        expenseConfig.survivorExpenseRatio,
      );

      survivorTransition = {
        deceasedMemberId: deceasedId!,
        survivingMemberId: survivorId!,
        transitionYear: year,
        deceasedBenefitAtDeath: deceasedLastBenefit,
        survivingOwnBenefit: survivingCurrentBenefit,
        survivorBenefit: survivorBenefitFixed,
        survivorExpenseRatio: expenseConfig.survivorExpenseRatio,
        coupleAnnualExpensesAtTransition: coupleExpensesAtTransition,
        projectedAnnualSurvivorExpenses: survivorExpenses,
        projectedAnnualSurvivorIncome: survivorBenefitFixed,
        annualGapAfterTransition: computeSurvivorIncomeGap(survivorBenefitFixed, survivorExpenses),
      };
    }

    // ---- Effective benefits (applies survivor enhancement in survivor phase) ----
    let primaryEffective: number;
    let spouseEffective: number;
    let primarySurvivorBenefit = 0;
    let spouseSurvivorBenefit = 0;

    if (isSurvivorPhase && survivorBenefitFixed !== null) {
      const yearsSinceTransition = year - firstDeathYear!;
      // Apply COLA on the frozen survivor benefit for years after the freeze year
      const survivingMember = survivorId === primary.memberId ? primary : spouse;
      const survivorBenefitThisYear = yearsSinceTransition > 0
        ? survivorBenefitFixed * Math.pow(1 + survivingMember.colaRate, yearsSinceTransition)
        : survivorBenefitFixed;

      if (survivorId === primary.memberId) {
        primarySurvivorBenefit = primaryAlive ? survivorBenefitThisYear : 0;
        primaryEffective = primaryAlive ? Math.max(primaryRawBenefit, survivorBenefitThisYear) : 0;
        spouseEffective = 0;
      } else {
        spouseSurvivorBenefit = spouseAlive ? survivorBenefitThisYear : 0;
        spouseEffective = spouseAlive ? Math.max(spouseRawBenefit, survivorBenefitThisYear) : 0;
        primaryEffective = 0;
      }
    } else {
      primaryEffective = primaryRawBenefit;
      spouseEffective = spouseRawBenefit;
    }

    const primaryResult: SocialSecurityYearResult = {
      year,
      memberId: primary.memberId,
      age: primaryAge,
      alive: primaryAlive,
      hasClaimed: primaryHasClaimed && primaryAlive,
      annualBenefit: primaryRawBenefit,
      survivorBenefit: primarySurvivorBenefit,
      effectiveBenefit: primaryEffective,
    };

    const spouseResult: SocialSecurityYearResult = {
      year,
      memberId: spouse.memberId,
      age: spouseAge,
      alive: spouseAlive,
      hasClaimed: spouseHasClaimed && spouseAlive,
      annualBenefit: spouseRawBenefit,
      survivorBenefit: spouseSurvivorBenefit,
      effectiveBenefit: spouseEffective,
    };

    const totalHouseholdBenefit = primaryEffective + spouseEffective;

    // Inflation-adjusted expenses
    const yearsFromStart = year - expenseConfig.simulationYearStart;
    const projectedExpenses = expenseConfig.coupleBaseExpenses *
      Math.pow(1 + expenseConfig.inflationRate, yearsFromStart);
    const survivorExpenses = isSurvivorPhase
      ? computeSurvivorExpenses(projectedExpenses, expenseConfig.survivorExpenseRatio)
      : 0;

    yearByYear.push({
      year,
      memberResults: [primaryResult, spouseResult],
      totalHouseholdBenefit,
      isSurvivorPhase,
      projectedExpenses,
      survivorExpenses,
    });

    // Tally coordination stats
    if (primaryEffective > 0 && spouseEffective > 0) yearsWithBothBenefits++;
    if (isSurvivorPhase) yearsInSurvivorPhase++;
  }

  const primaryClaimYear = primaryClaimStartYear ?? (projectionStartYear +
    Math.max(0, primary.claimAge - getMemberAgeAtYear(primary.dateOfBirth, projectionStartYear)));
  const spouseClaimYear = spouseClaimStartYear ?? (projectionStartYear +
    Math.max(0, spouse.claimAge - getMemberAgeAtYear(spouse.dateOfBirth, projectionStartYear)));

  const coordination: CoupleRetirementCoordinationResult = {
    primaryMemberId: primary.memberId,
    spouseMemberId: spouse.memberId,
    primaryRetirementYear: primaryRetirementYear ?? projectionStartYear,
    spouseRetirementYear: spouseRetirementYear ?? projectionStartYear,
    primaryClaimYear,
    spouseClaimYear,
    yearsWithBothBenefits,
    yearsInSurvivorPhase,
    firstDeathYear,
  };

  return { yearByYear, coordination, survivorTransition };
}
