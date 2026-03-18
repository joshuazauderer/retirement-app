import type {
  SimulationSnapshot,
  ProjectionYearState,
  DeterministicProjectionResult,
  ProjectionRunSummary,
} from "./types";
import { getMemberAgeAtYear } from "./normalizeInputs";
import type { WithdrawalStrategyConfig, WithdrawalOrderingType } from "../withdrawalStrategies/types";
import {
  createPolicyEngineState,
  initializePolicyStateAtRetirement,
  computeWithdrawalInstruction,
  advancePolicyState,
} from "../withdrawalStrategies/withdrawalPolicyEngine";
import { executeOrderedWithdrawals } from "../withdrawalStrategies/withdrawalOrderingService";

/**
 * Run a deterministic year-by-year projection.
 *
 * @param options.annualReturns Per-year portfolio return vector for Monte Carlo mode.
 *   Index 0 = first projection year. When provided, all accounts use this return for
 *   the year instead of their individual expectedReturnRate. This keeps the cash-flow
 *   ordering and withdrawal logic identical to the deterministic path.
 *
 * Limitation: v1 applies one portfolio-level return across all accounts per year.
 * Individual account allocations are not modeled separately.
 */
export function runDeterministicProjection(
  snapshot: SimulationSnapshot,
  options?: {
    /** Per-year portfolio return vector (Monte Carlo mode). Index 0 = first projection year. */
    annualReturns?: number[];
    /**
     * Phase 7: Injectable withdrawal policy. When provided, the policy determines
     * the withdrawal target each retirement year instead of the raw cash-flow gap.
     * Pre-retirement years always remain needs-based.
     */
    withdrawalPolicy?: WithdrawalStrategyConfig;
    /**
     * Phase 7: Withdrawal ordering strategy. Defaults to TAXABLE_FIRST when absent,
     * preserving the existing engine behavior.
     */
    orderingType?: WithdrawalOrderingType;
  }
): DeterministicProjectionResult {
  const {
    timeline,
    members,
    incomeSources,
    assetAccounts,
    liabilities,
    expenseProfile,
    benefitSources,
    planningAssumptions,
  } = snapshot;

  const years: number[] = [];
  for (let y = timeline.simulationYearStart; y <= timeline.projectionEndYear; y++) {
    years.push(y);
  }

  // Mutable state — account balances
  let accountBalances: Record<string, number> = {};
  for (const acc of assetAccounts) {
    accountBalances[acc.id] = acc.currentBalance;
  }

  let liabilityBalances: Record<string, number> = {};
  for (const lib of liabilities) {
    liabilityBalances[lib.id] = lib.currentBalance;
  }

  const yearResults: ProjectionYearState[] = [];
  let firstDepletionYear: number | null = null;
  let firstRetirementYear: number | null = null;
  let totalWithdrawals = 0;
  let totalTaxes = 0;
  let totalShortfall = 0;

  // Track when each benefit first became active for COLA calculation
  const benefitStartYear: Record<string, number> = {};

  // Phase 7: Policy engine state — carries guardrail target and baseline values across years
  const policyState = createPolicyEngineState();
  const effectiveOrdering = options?.orderingType ?? 'TAXABLE_FIRST';

  for (const year of years) {
    const n = year - timeline.simulationYearStart; // years from baseline

    // ---- STEP 1: Member state for this year ----
    const memberAges: Record<string, number> = {};
    const memberAlive: Record<string, boolean> = {};
    const memberRetired: Record<string, boolean> = {};

    for (const m of members) {
      const age = getMemberAgeAtYear(m.dateOfBirth, year);
      memberAges[m.memberId] = age;
      memberAlive[m.memberId] = age <= m.lifeExpectancy;
      memberRetired[m.memberId] = age >= m.retirementTargetAge;

      if (memberRetired[m.memberId] && firstRetirementYear === null) {
        firstRetirementYear = year;
      }
    }

    const anyoneAlive = Object.values(memberAlive).some((v) => v);
    if (!anyoneAlive) {
      // Stop projecting once all members have passed their life expectancy
      break;
    }

    // ---- Beginning of year asset total ----
    const beginningTotalAssets = Object.values(accountBalances).reduce(
      (s, v) => s + v,
      0
    );

    // ---- STEP 2: Earned income ----
    let earnedIncome = 0;
    for (const src of incomeSources) {
      if (src.memberId && !memberAlive[src.memberId]) continue;
      const memberIsRetired = src.memberId
        ? memberRetired[src.memberId]
        : false;
      if (!src.isPostRetirementIncome && memberIsRetired) continue;
      if (src.startYear != null && year < src.startYear) continue;
      if (src.endYear != null && year > src.endYear) continue;
      const yearsOfGrowth = src.startYear != null
        ? Math.max(0, year - src.startYear)
        : n;
      earnedIncome +=
        src.annualAmount * Math.pow(1 + src.growthRate, yearsOfGrowth);
    }

    // ---- STEP 3: Contributions ----
    let totalContributions = 0;
    for (const acc of assetAccounts) {
      if (acc.annualContribution === 0) continue;
      if (acc.memberId && !memberAlive[acc.memberId]) continue;
      const memberIsRetired = acc.memberId
        ? memberRetired[acc.memberId]
        : false;
      if (acc.isRetirementAccount && memberIsRetired) continue;
      totalContributions += acc.annualContribution;
    }

    // ---- STEP 4: Benefit income ----
    let benefitsIncome = 0;
    for (const b of benefitSources) {
      if (b.memberId && !memberAlive[b.memberId]) continue;
      const memberAge = b.memberId ? memberAges[b.memberId] : 65;
      let benefitActive = false;
      if (b.startYear != null && year >= b.startYear) benefitActive = true;
      else if (b.claimAge != null && memberAge >= b.claimAge) benefitActive = true;
      if (!benefitActive) continue;
      if (!benefitStartYear[b.id]) benefitStartYear[b.id] = year;
      const yearsActive = year - benefitStartYear[b.id];
      benefitsIncome += b.annualBenefit * Math.pow(1 + b.colaRate, yearsActive);
    }

    const totalIncome = earnedIncome + benefitsIncome;

    // ---- STEP 5: Expenses (inflation-adjusted) ----
    const primaryMember =
      members.find((m) => m.isPrimary) ?? members[0];
    const primaryRetired = memberRetired[primaryMember.memberId];
    let expenseBase: number;
    if (!primaryRetired) {
      expenseBase = expenseProfile.currentAnnualSpending;
    } else {
      expenseBase =
        expenseProfile.retirementEssential +
        expenseProfile.retirementDiscretionary +
        expenseProfile.healthcareAnnual +
        expenseProfile.housingAnnual;
      if (expenseBase === 0) {
        expenseBase = expenseProfile.currentAnnualSpending * 0.8;
      }
    }
    const expenses =
      expenseBase * Math.pow(1 + planningAssumptions.inflationRate, n);

    // ---- STEP 6: Liability payments ----
    let liabilityPayments = 0;
    for (const lib of liabilities) {
      if (lib.payoffYear != null && year > lib.payoffYear) continue;
      if (liabilityBalances[lib.id] <= 0) continue;
      const payment = Math.min(lib.annualPayment, liabilityBalances[lib.id]);
      liabilityPayments += payment;
    }

    // ---- STEP 7: Taxes (planning-grade flat rate) ----
    const taxes =
      (earnedIncome + benefitsIncome) *
      planningAssumptions.assumedEffectiveTaxRate;

    // ---- STEP 8: Cash flow gap → required withdrawal ----
    const totalOutflows =
      expenses + liabilityPayments + taxes + totalContributions;
    const netCashFlow = totalIncome - totalOutflows;
    const requiredWithdrawal = Math.max(0, -netCashFlow);

    // ---- STEP 9: Execute withdrawals ----
    // Phase 7: If a withdrawal policy is configured and the primary member is
    // retired, let the policy engine determine the target withdrawal amount and
    // direction. Otherwise, fall back to the needs-based gap.
    let policyWithdrawalTarget: number | undefined;
    let guardrailDir: 'none' | 'reduced' | 'increased' = 'none';

    if (options?.withdrawalPolicy && primaryRetired) {
      // First retirement year: initialize policy state with starting portfolio value
      initializePolicyStateAtRetirement(
        policyState,
        year,
        beginningTotalAssets,
        options.withdrawalPolicy
      );

      const instruction = computeWithdrawalInstruction(
        options.withdrawalPolicy,
        year,
        policyState,
        requiredWithdrawal,
        beginningTotalAssets,
        planningAssumptions.inflationRate,
        primaryRetired
      );

      policyWithdrawalTarget = instruction.targetWithdrawal;
      guardrailDir = instruction.guardrailDirection;

      // Carry the instruction target forward for guardrail continuity
      advancePolicyState(policyState, instruction);
    }

    const effectiveWithdrawalRequest =
      policyWithdrawalTarget !== undefined ? policyWithdrawalTarget : requiredWithdrawal;

    const withdrawalResult = executeOrderedWithdrawals(
      effectiveWithdrawalRequest,
      accountBalances,
      assetAccounts,
      planningAssumptions.assumedEffectiveTaxRate,
      effectiveOrdering
    );

    // ---- STEP 10: Investment growth + update account balances ----
    // In Monte Carlo mode, options.annualReturns[n] overrides per-account rates so
    // every account experiences the same sampled portfolio return for this year.
    const newAccountBalances: Record<string, number> = {};
    for (const acc of assetAccounts) {
      const r = options?.annualReturns?.[n] ?? acc.expectedReturnRate;
      const beginBal = accountBalances[acc.id];
      const contrib = (() => {
        if (acc.annualContribution === 0) return 0;
        if (acc.memberId && !memberAlive[acc.memberId]) return 0;
        const memberIsRetired = acc.memberId
          ? memberRetired[acc.memberId]
          : false;
        if (acc.isRetirementAccount && memberIsRetired) return 0;
        return acc.annualContribution;
      })();
      const withdrawn = withdrawalResult.byAccount[acc.id] ?? 0;
      // Mid-year convention: contributions and withdrawals earn/cost 0.5 year of return
      const endBal =
        beginBal * (1 + r) +
        contrib * (1 + 0.5 * r) -
        withdrawn * (1 + 0.5 * r);
      newAccountBalances[acc.id] = Math.max(0, endBal);
    }

    // ---- STEP 11: Update liability balances ----
    const newLiabilityBalances: Record<string, number> = {};
    for (const lib of liabilities) {
      const oldBal = liabilityBalances[lib.id];
      if (lib.payoffYear != null && year > lib.payoffYear) {
        newLiabilityBalances[lib.id] = 0;
        continue;
      }
      if (oldBal <= 0) {
        newLiabilityBalances[lib.id] = 0;
        continue;
      }
      const interest = oldBal * lib.interestRate;
      const payment = Math.min(lib.annualPayment, oldBal + interest);
      newLiabilityBalances[lib.id] = Math.max(0, oldBal + interest - payment);
    }

    const endingTotalAssets = Object.values(newAccountBalances).reduce(
      (s, v) => s + v,
      0
    );
    const totalLiabilitiesBalance = Object.values(newLiabilityBalances).reduce(
      (s, v) => s + v,
      0
    );
    const netWorth = endingTotalAssets - totalLiabilitiesBalance;
    const investmentGrowth =
      endingTotalAssets -
      beginningTotalAssets -
      totalContributions +
      withdrawalResult.actualWithdrawal;
    const depleted = withdrawalResult.shortfall > 0;

    if (depleted && firstDepletionYear === null) {
      firstDepletionYear = year;
    }

    totalWithdrawals += withdrawalResult.actualWithdrawal;
    totalTaxes += taxes;
    totalShortfall += withdrawalResult.shortfall;

    yearResults.push({
      year,
      memberAges,
      memberAlive,
      memberRetired,
      beginningTotalAssets,
      earnedIncome,
      benefitsIncome,
      totalIncome,
      expenses,
      liabilityPayments,
      taxes,
      contributions: totalContributions,
      requiredWithdrawal,
      policyWithdrawalTarget,
      guardrailDirection: guardrailDir,
      withdrawalsByBucket: withdrawalResult.byBucket,
      withdrawalsByAccount: withdrawalResult.byAccount,
      actualWithdrawal: withdrawalResult.actualWithdrawal,
      shortfall: withdrawalResult.shortfall,
      investmentGrowth,
      endingTotalAssets,
      endingAccountBalances: newAccountBalances,
      endingLiabilityBalances: newLiabilityBalances,
      netWorth,
      depleted,
    });

    // Advance mutable state
    accountBalances = newAccountBalances;
    liabilityBalances = newLiabilityBalances;
  }

  const lastYear = yearResults[yearResults.length - 1];
  const summary: ProjectionRunSummary = {
    householdId: snapshot.household.householdId,
    runType: "deterministic",
    projectionStartYear: timeline.simulationYearStart,
    projectionEndYear: timeline.projectionEndYear,
    yearsProjected: yearResults.length,
    success: firstDepletionYear === null,
    firstRetirementYear,
    firstDepletionYear,
    endingBalance: lastYear?.endingTotalAssets ?? 0,
    endingNetWorth: lastYear?.netWorth ?? 0,
    totalWithdrawals,
    totalTaxes,
    totalShortfall,
  };

  return {
    snapshot,
    yearByYear: yearResults,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Note: withdrawal execution is now handled by executeOrderedWithdrawals()
// in src/server/withdrawalStrategies/withdrawalOrderingService.ts.
// This keeps ordering logic centralized, typed, and testable.
// ---------------------------------------------------------------------------
