/**
 * Tax Planning Service — Phase 9
 *
 * Main orchestration service for tax-aware retirement projection.
 *
 * Integrates all tax components into a single year-by-year simulation run:
 * - Bracket-based federal tax (replacing flat-rate)
 * - State income tax
 * - Social Security taxation (provisional income method)
 * - Capital gains approximation for taxable-account withdrawals
 * - Roth conversion income and balance reclassification
 *
 * Engine integration: the tax layer is woven into the annual cash-flow loop,
 * not bolted on afterward. Taxes affect the cash-flow gap, withdrawal amounts,
 * account balances, and plan durability.
 *
 * v1 Limitations documented in individual service files.
 */

import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '../simulation/buildSimulationSnapshot';
import type { SimulationSnapshot } from '../simulation/types';
import { getMemberAgeAtYear } from '../simulation/normalizeInputs';
import { executeOrderedWithdrawals } from '../withdrawalStrategies/withdrawalOrderingService';
import { estimateFederalTax } from './federalTaxService';
import { estimateStateTax, getStateEffectiveRate } from './stateTaxService';
import { estimateSocialSecurityTax } from './socialSecurityTaxService';
import {
  initializeBasisState,
  estimateCapitalGainsTax,
  sumTaxableBalances,
  type TaxableBasisState,
} from './capitalGainsApproximationService';
import { getConversionAmountForYear, executeRothConversion } from './rothConversionService';
import type {
  TaxAssumptions,
  TaxPlanningRunInput,
  TaxPlanningRunResult,
  TaxPlanningRunSummary,
  TaxPlanningYearResult,
  TaxPlanningSummaryItem,
  TaxPlanningValidation,
  AnnualTaxBreakdown,
  FilingStatusType,
} from './types';
import { TAX_BOUNDS } from './types';
import type { WithdrawalOrderingType } from '../withdrawalStrategies/types';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateTaxPlanningInput(
  input: TaxPlanningRunInput
): TaxPlanningValidation {
  const errors: string[] = [];

  if (!input.householdId) errors.push('householdId is required.');
  if (!input.scenarioId) errors.push('scenarioId is required.');

  const ta = input.taxAssumptions;
  if (ta.capitalGainsBasisRatio !== undefined) {
    if (ta.capitalGainsBasisRatio < 0 || ta.capitalGainsBasisRatio > 1) {
      errors.push('capitalGainsBasisRatio must be between 0 and 1.');
    }
  }
  if (ta.rothConversion) {
    const rc = ta.rothConversion;
    if (rc.annualConversionAmount < 0 || rc.annualConversionAmount > TAX_BOUNDS.MAX_CONVERSION_AMOUNT) {
      errors.push(`rothConversion.annualConversionAmount must be between 0 and ${TAX_BOUNDS.MAX_CONVERSION_AMOUNT}.`);
    }
    if (rc.startYear > rc.endYear) {
      errors.push('rothConversion.startYear must be ≤ endYear.');
    }
    if (rc.startYear < 2000 || rc.endYear > 2200) {
      errors.push('rothConversion year range must be between 2000 and 2200.');
    }
  }

  const validOrderings = ['TAXABLE_FIRST', 'TAX_DEFERRED_FIRST', 'TAX_FREE_FIRST', 'PRO_RATA'];
  if (input.withdrawalOrderingType && !validOrderings.includes(input.withdrawalOrderingType)) {
    errors.push(`withdrawalOrderingType must be one of: ${validOrderings.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Map filing status string to FilingStatusType
// ---------------------------------------------------------------------------

function mapFilingStatus(raw: string): FilingStatusType {
  const map: Record<string, FilingStatusType> = {
    SINGLE: 'SINGLE',
    MARRIED_FILING_JOINTLY: 'MARRIED_FILING_JOINTLY',
    MARRIED_FILING_SEPARATELY: 'MARRIED_FILING_SEPARATELY',
    HEAD_OF_HOUSEHOLD: 'HEAD_OF_HOUSEHOLD',
  };
  return map[raw] ?? 'SINGLE';
}

// ---------------------------------------------------------------------------
// Core year-by-year tax-aware projection
// ---------------------------------------------------------------------------

interface ProjectionOptions {
  taxAssumptions: TaxAssumptions;
  orderingType: WithdrawalOrderingType;
}

function runTaxAwareProjection(
  snapshot: SimulationSnapshot,
  options: ProjectionOptions
): { yearByYear: TaxPlanningYearResult[]; summary: TaxPlanningRunSummary } {
  const { taxAssumptions, orderingType } = options;
  const {
    timeline,
    members,
    incomeSources,
    assetAccounts,
    liabilities,
    expenseProfile,
    benefitSources,
    planningAssumptions,
    household,
  } = snapshot;

  const filingStatus = taxAssumptions.filingStatus;
  const stateOfResidence = taxAssumptions.stateOfResidence;
  const inflationRate = planningAssumptions.inflationRate;
  const bracketBaseYear = taxAssumptions.bracketBaseYear;
  const rothConfig = taxAssumptions.rothConversion;

  // Initialize mutable state
  let accountBalances: Record<string, number> = {};
  for (const acc of assetAccounts) accountBalances[acc.id] = acc.currentBalance;

  let liabilityBalances: Record<string, number> = {};
  for (const lib of liabilities) liabilityBalances[lib.id] = lib.currentBalance;

  // Basis state for capital gains tracking
  const initialTaxableBalance = sumTaxableBalances(accountBalances, assetAccounts);
  const basisState: TaxableBasisState = initializeBasisState(
    initialTaxableBalance,
    taxAssumptions.capitalGainsBasisRatio
  );

  const yearResults: TaxPlanningYearResult[] = [];
  const benefitStartYear: Record<string, number> = {};

  let firstDepletionYear: number | null = null;
  let firstRetirementYear: number | null = null;
  let totalWithdrawals = 0;
  let totalFederalTax = 0;
  let totalStateTax = 0;
  let totalCapitalGainsTax = 0;
  let totalRothConverted = 0;
  let totalRothConversionTax = 0;
  let rothConversionYears = 0;
  let taxAtRetirementStart: number | null = null;

  for (let year = timeline.simulationYearStart; year <= timeline.projectionEndYear; year++) {
    const n = year - timeline.simulationYearStart;

    // ---- STEP 1: Member state ----
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

    const anyoneAlive = Object.values(memberAlive).some(Boolean);
    if (!anyoneAlive) break;

    const primaryMember = members.find((m) => m.isPrimary) ?? members[0];
    const primaryRetired = memberRetired[primaryMember.memberId];

    const beginningTotalAssets = Object.values(accountBalances).reduce((s, v) => s + v, 0);

    // ---- STEP 2: Roth conversion (beginning of year) ----
    let conversionAmount = 0;
    if (rothConfig) {
      const target = getConversionAmountForYear(rothConfig, year, inflationRate, timeline.simulationYearStart);
      if (target > 0) {
        const result = executeRothConversion(target, accountBalances, assetAccounts);
        conversionAmount = result.actualConversionAmount;
        accountBalances = result.updatedBalances;
        totalRothConverted += conversionAmount;
        rothConversionYears += conversionAmount > 0 ? 1 : 0;
      }
    }

    // ---- STEP 3: Earned income ----
    let earnedIncome = 0;
    for (const src of incomeSources) {
      if (src.memberId && !memberAlive[src.memberId]) continue;
      const isRetired = src.memberId ? memberRetired[src.memberId] : false;
      if (!src.isPostRetirementIncome && isRetired) continue;
      if (src.startYear != null && year < src.startYear) continue;
      if (src.endYear != null && year > src.endYear) continue;
      const yearsOfGrowth = src.startYear != null ? Math.max(0, year - src.startYear) : n;
      earnedIncome += src.annualAmount * Math.pow(1 + src.growthRate, yearsOfGrowth);
    }

    // ---- STEP 4: Contributions ----
    let totalContributions = 0;
    for (const acc of assetAccounts) {
      if (acc.annualContribution === 0) continue;
      if (acc.memberId && !memberAlive[acc.memberId]) continue;
      const isRetired = acc.memberId ? memberRetired[acc.memberId] : false;
      if (acc.isRetirementAccount && isRetired) continue;
      totalContributions += acc.annualContribution;
    }

    // ---- STEP 5: Benefit income ----
    let benefitsIncome = 0;
    let ssBenefits = 0;
    for (const b of benefitSources) {
      if (b.memberId && !memberAlive[b.memberId]) continue;
      const memberAge = b.memberId ? memberAges[b.memberId] : 65;
      let active = false;
      if (b.startYear != null && year >= b.startYear) active = true;
      else if (b.claimAge != null && memberAge >= b.claimAge) active = true;
      if (!active) continue;
      if (!benefitStartYear[b.id]) benefitStartYear[b.id] = year;
      const yearsActive = year - benefitStartYear[b.id];
      const benefit = b.annualBenefit * Math.pow(1 + b.colaRate, yearsActive);
      benefitsIncome += benefit;
      if (b.type === 'SOCIAL_SECURITY') ssBenefits += benefit;
    }

    const nonSsBenefitIncome = benefitsIncome - ssBenefits;

    // ---- STEP 6: Expenses ----
    let expenseBase: number;
    if (!primaryRetired) {
      expenseBase = expenseProfile.currentAnnualSpending;
    } else {
      expenseBase = expenseProfile.retirementEssential + expenseProfile.retirementDiscretionary +
        expenseProfile.healthcareAnnual + expenseProfile.housingAnnual;
      if (expenseBase === 0) expenseBase = expenseProfile.currentAnnualSpending * 0.8;
    }
    const expenses = expenseBase * Math.pow(1 + inflationRate, n);

    // ---- STEP 7: Liability payments ----
    let liabilityPayments = 0;
    for (const lib of liabilities) {
      if (lib.payoffYear != null && year > lib.payoffYear) continue;
      if (liabilityBalances[lib.id] <= 0) continue;
      liabilityPayments += Math.min(lib.annualPayment, liabilityBalances[lib.id]);
    }

    // ---- STEP 8: Pre-withdrawal tax estimate ----
    // Estimate SS taxable portion on pre-withdrawal income
    // (conversion amount IS known at this point)
    const magiProxy = earnedIncome + nonSsBenefitIncome + conversionAmount;
    const ssTaxResult = estimateSocialSecurityTax({
      filingStatus,
      ssBenefits,
      magiExcludingSS: magiProxy,
    });

    // Estimate federal tax on pre-withdrawal income (no withdrawal component yet)
    const preFedResult = estimateFederalTax({
      filingStatus,
      earnedIncome,
      nonSsBenefitIncome,
      taxableSsAmount: ssTaxResult.taxableSsAmount,
      taxDeferredWithdrawal: 0, // not known yet
      capitalGainsIncome: 0,    // not known yet
      rothConversionAmount: conversionAmount,
      year,
      inflationRate,
      bracketBaseYear,
    });
    const preStateTax = estimateStateTax(stateOfResidence, preFedResult.ordinaryTaxableIncome);
    const preWithdrawalTax = preFedResult.totalFederalTax + preStateTax.stateTax;

    // ---- STEP 9: Cash flow gap → withdrawals ----
    const totalOutflows = expenses + liabilityPayments + preWithdrawalTax + totalContributions;
    const totalPreWithdrawalIncome = earnedIncome + benefitsIncome;
    const netCashPreWithdrawal = totalPreWithdrawalIncome - totalOutflows;
    const requiredWithdrawal = Math.max(0, -netCashPreWithdrawal);

    // Execute withdrawals with ordering
    const withdrawalResult = executeOrderedWithdrawals(
      requiredWithdrawal,
      accountBalances,
      assetAccounts,
      planningAssumptions.assumedEffectiveTaxRate, // fallback rate for gross-up
      orderingType
    );

    const taxDeferredWithdrawal = withdrawalResult.byBucket.taxDeferred;
    const taxableWithdrawal = withdrawalResult.byBucket.taxable;
    const taxFreeWithdrawal = withdrawalResult.byBucket.taxFree;

    // ---- STEP 10: Full tax calculation with withdrawal info ----
    // Update SS taxable estimate with full income including withdrawals
    const magiWithWithdrawals = earnedIncome + nonSsBenefitIncome + taxDeferredWithdrawal + conversionAmount;
    const ssTaxFull = estimateSocialSecurityTax({
      filingStatus,
      ssBenefits,
      magiExcludingSS: magiWithWithdrawals,
    });

    // Taxable account capital gains
    const taxableAcctContribs = assetAccounts
      .filter((a) => a.taxTreatment === 'TAXABLE')
      .reduce((s, a) => {
        if (a.memberId && !memberAlive[a.memberId]) return s;
        return s + a.annualContribution;
      }, 0);

    // Estimate ordinary taxable income (without cap gains) for CG rate lookup
    const ordinaryForCGRate = Math.max(0,
      earnedIncome + nonSsBenefitIncome + ssTaxFull.taxableSsAmount + taxDeferredWithdrawal + conversionAmount
      - preFedResult.standardDeduction
    );

    const cgResult = estimateCapitalGainsTax({
      taxableWithdrawal,
      filingStatus,
      ordinaryTaxableIncome: ordinaryForCGRate,
      basisState,
      newContributions: taxableAcctContribs,
      accountGrowth: 0, // growth tracked at end of year
    });

    // Full federal tax
    const fullFedResult = estimateFederalTax({
      filingStatus,
      earnedIncome,
      nonSsBenefitIncome,
      taxableSsAmount: ssTaxFull.taxableSsAmount,
      taxDeferredWithdrawal,
      capitalGainsIncome: cgResult.estimatedGainAmount,
      rothConversionAmount: conversionAmount,
      year,
      inflationRate,
      bracketBaseYear,
    });

    // Full state tax (on same base as federal ordinary income)
    const fullStateTax = estimateStateTax(stateOfResidence, fullFedResult.ordinaryTaxableIncome);

    const totalTax = fullFedResult.totalFederalTax + fullStateTax.stateTax;
    const grossIncome = earnedIncome + benefitsIncome + withdrawalResult.actualWithdrawal + conversionAmount;

    // Roth conversion tax impact estimate
    const conversionTaxImpact =
      conversionAmount > 0
        ? conversionAmount * (fullFedResult.marginalFederalRate + fullStateTax.stateRate)
        : 0;

    if (conversionAmount > 0) totalRothConversionTax += conversionTaxImpact;

    const effectiveTotalRate =
      grossIncome > 0 ? totalTax / grossIncome : 0;

    const taxBreakdown: AnnualTaxBreakdown = {
      year,
      filingStatus,
      earnedIncome,
      benefitsIncome,
      ssBenefits,
      ssTaxableAmount: ssTaxFull.taxableSsAmount,
      taxDeferredWithdrawal,
      taxableWithdrawal,
      taxFreeWithdrawal,
      rothConversionAmount: conversionAmount,
      capitalGainsAmount: cgResult.estimatedGainAmount,
      capitalGainsRate: cgResult.capitalGainsRate,
      capitalGainsTax: cgResult.estimatedCapitalGainsTax,
      federalOrdinaryIncome: earnedIncome + nonSsBenefitIncome + ssTaxFull.taxableSsAmount + taxDeferredWithdrawal + conversionAmount,
      federalTaxableIncome: fullFedResult.ordinaryTaxableIncome,
      federalTax: fullFedResult.totalFederalTax,
      marginalFederalRate: fullFedResult.marginalFederalRate,
      effectiveFederalRate: fullFedResult.effectiveFederalRate,
      stateTax: fullStateTax.stateTax,
      effectiveStateRate: fullStateTax.stateRate,
      totalTax,
      effectiveTotalRate,
      rothConversionTaxImpact: conversionTaxImpact,
    };

    // ---- STEP 11: Investment growth + update balances ----
    const newAccountBalances: Record<string, number> = {};
    for (const acc of assetAccounts) {
      const r = acc.expectedReturnRate;
      const beginBal = accountBalances[acc.id];
      const contrib = (() => {
        if (acc.annualContribution === 0) return 0;
        if (acc.memberId && !memberAlive[acc.memberId]) return 0;
        const isRetired = acc.memberId ? memberRetired[acc.memberId] : false;
        if (acc.isRetirementAccount && isRetired) return 0;
        return acc.annualContribution;
      })();
      const withdrawn = withdrawalResult.byAccount[acc.id] ?? 0;
      const endBal = beginBal * (1 + r) + contrib * (1 + 0.5 * r) - withdrawn * (1 + 0.5 * r);
      newAccountBalances[acc.id] = Math.max(0, endBal);
    }

    // Update liability balances
    const newLiabilityBalances: Record<string, number> = {};
    for (const lib of liabilities) {
      const oldBal = liabilityBalances[lib.id];
      if (lib.payoffYear != null && year > lib.payoffYear || oldBal <= 0) {
        newLiabilityBalances[lib.id] = 0;
        continue;
      }
      const interest = oldBal * lib.interestRate;
      const payment = Math.min(lib.annualPayment, oldBal + interest);
      newLiabilityBalances[lib.id] = Math.max(0, oldBal + interest - payment);
    }

    const endingTotalAssets = Object.values(newAccountBalances).reduce((s, v) => s + v, 0);
    const totalLiabilities = Object.values(newLiabilityBalances).reduce((s, v) => s + v, 0);
    const depleted = withdrawalResult.shortfall > 0;
    if (depleted && firstDepletionYear === null) firstDepletionYear = year;

    // Track totals
    totalWithdrawals += withdrawalResult.actualWithdrawal;
    totalFederalTax += fullFedResult.totalFederalTax;
    totalStateTax += fullStateTax.stateTax;
    totalCapitalGainsTax += cgResult.estimatedCapitalGainsTax;

    if (primaryRetired && taxAtRetirementStart === null) {
      taxAtRetirementStart = totalTax;
    }

    const netCash = grossIncome - totalTax - expenses - liabilityPayments;

    yearResults.push({
      year,
      grossIncome,
      earnedIncome,
      benefitsIncome,
      ssBenefits,
      withdrawals: withdrawalResult.actualWithdrawal,
      taxDeferredWithdrawal,
      taxFreeWithdrawal,
      taxableWithdrawal,
      rothConversionAmount: conversionAmount,
      taxBreakdown,
      expenses,
      liabilityPayments,
      totalTax,
      netCash,
      shortfall: withdrawalResult.shortfall,
      beginningAssets: beginningTotalAssets,
      endingAssets: endingTotalAssets,
      depleted,
      taxableBasisBalance: basisState.totalBasis,
    });

    accountBalances = newAccountBalances;
    liabilityBalances = newLiabilityBalances;
  }

  // ---- Summary ----
  const lastYear = yearResults[yearResults.length - 1];
  const retirementYears = yearResults.filter((y) =>
    Object.values(y.taxBreakdown).length > 0 && y.totalTax > 0
  );
  const avgAnnualTax = retirementYears.length > 0
    ? retirementYears.reduce((s, y) => s + y.totalTax, 0) / retirementYears.length
    : 0;
  const avgEffectiveRate = retirementYears.length > 0
    ? retirementYears.reduce((s, y) => s + y.taxBreakdown.effectiveTotalRate, 0) / retirementYears.length
    : 0;
  const peakYear = yearResults.reduce((best, y) =>
    y.totalTax > (best?.totalTax ?? 0) ? y : best, yearResults[0]);

  const endingNetWorth = (lastYear?.endingAssets ?? 0) -
    Object.values(liabilityBalances).reduce((s, v) => s + v, 0);

  const summary: TaxPlanningRunSummary = {
    totalFederalTax,
    totalStateTax,
    totalLifetimeTax: totalFederalTax + totalStateTax,
    totalCapitalGainsTax,
    averageAnnualTax: avgAnnualTax,
    averageEffectiveRate: avgEffectiveRate,
    peakAnnualTax: peakYear?.totalTax ?? 0,
    peakTaxYear: peakYear?.year ?? timeline.simulationYearStart,
    taxAtRetirementStart: taxAtRetirementStart ?? 0,
    success: firstDepletionYear === null,
    firstDepletionYear,
    firstRetirementYear,
    endingAssets: lastYear?.endingAssets ?? 0,
    endingNetWorth,
    totalWithdrawals,
    rothConversionYears,
    totalRothConverted,
    totalRothConversionTax,
    filingStatus,
    stateOfResidence,
    projectionStartYear: timeline.simulationYearStart,
    projectionEndYear: timeline.projectionEndYear,
  };

  return { yearByYear: yearResults, summary };
}

// ---------------------------------------------------------------------------
// Public service: run and persist
// ---------------------------------------------------------------------------

export async function runTaxPlanningAnalysis(
  input: TaxPlanningRunInput
): Promise<TaxPlanningRunResult> {
  const validation = validateTaxPlanningInput(input);
  if (!validation.valid) {
    throw new Error(`Tax planning validation failed: ${validation.errors.join('; ')}`);
  }

  // Load scenario to get snapshot
  const scenario = await prisma.scenario.findUnique({
    where: { id: input.scenarioId },
    select: { id: true, name: true, householdId: true, overridesJson: true },
  });
  if (!scenario || scenario.householdId !== input.householdId) {
    throw new Error('Scenario not found or access denied.');
  }

  // Load household for filing status and state
  const household = await prisma.household.findUnique({
    where: { id: input.householdId },
    select: { filingStatus: true, stateOfResidence: true },
  });
  if (!household) throw new Error('Household not found.');

  const filingStatus = mapFilingStatus(household.filingStatus);
  const stateOfResidence = household.stateOfResidence ?? 'Unknown';

  const snapshot = await buildSimulationSnapshot(input.householdId, prisma);

  const taxAssumptions: TaxAssumptions = {
    filingStatus,
    stateOfResidence,
    capitalGainsBasisRatio: input.taxAssumptions.capitalGainsBasisRatio ?? TAX_BOUNDS.DEFAULT_BASIS_RATIO,
    bracketBaseYear: TAX_BOUNDS.BRACKET_BASE_YEAR,
    rothConversion: input.taxAssumptions.rothConversion
      ? {
          annualConversionAmount: input.taxAssumptions.rothConversion.annualConversionAmount,
          startYear: input.taxAssumptions.rothConversion.startYear,
          endYear: input.taxAssumptions.rothConversion.endYear,
          inflateWithInflation: false,
        }
      : undefined,
  };

  const orderingType = (input.withdrawalOrderingType as WithdrawalOrderingType) ?? 'TAXABLE_FIRST';

  const { yearByYear, summary } = runTaxAwareProjection(snapshot, { taxAssumptions, orderingType });

  const label = input.label ?? `Tax Analysis — ${scenario.name} — ${new Date().getFullYear()}`;

  // Persist
  const run = await prisma.taxPlanningRun.create({
    data: {
      householdId: input.householdId,
      scenarioId: input.scenarioId,
      label,
      taxConfigJson: taxAssumptions as unknown as Prisma.InputJsonValue,
      snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
      summaryJson: summary as unknown as Prisma.InputJsonValue,
      yearlyJson: yearByYear as unknown as Prisma.InputJsonValue,
      totalFederalTax: new Prisma.Decimal(Math.round(summary.totalFederalTax)),
      totalStateTax: new Prisma.Decimal(Math.round(summary.totalStateTax)),
      totalLifetimeTax: new Prisma.Decimal(Math.round(summary.totalLifetimeTax)),
      firstDepletionYear: summary.firstDepletionYear,
      success: summary.success,
      projectionStartYear: summary.projectionStartYear,
      projectionEndYear: summary.projectionEndYear,
    },
  });

  return {
    runId: run.id,
    householdId: input.householdId,
    scenarioId: input.scenarioId,
    scenarioName: scenario.name,
    label,
    createdAt: run.createdAt.toISOString(),
    taxAssumptions,
    summary,
    yearByYear,
  };
}

// ---------------------------------------------------------------------------
// List and get runs
// ---------------------------------------------------------------------------

export async function listTaxPlanningRuns(householdId: string): Promise<TaxPlanningSummaryItem[]> {
  const runs = await prisma.taxPlanningRun.findMany({
    where: { householdId },
    include: { scenario: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return runs.map((r) => {
    const config = r.taxConfigJson as unknown as TaxAssumptions;
    return {
      runId: r.id,
      label: r.label ?? 'Tax Analysis',
      scenarioName: r.scenario?.name ?? '(No scenario)',
      filingStatus: config?.filingStatus ?? 'SINGLE',
      stateOfResidence: config?.stateOfResidence ?? '',
      success: r.success,
      firstDepletionYear: r.firstDepletionYear,
      totalLifetimeTax: Number(r.totalLifetimeTax),
      totalFederalTax: Number(r.totalFederalTax),
      totalStateTax: Number(r.totalStateTax),
      totalWithdrawals: (r.summaryJson as unknown as TaxPlanningRunSummary)?.totalWithdrawals ?? 0,
      endingAssets: (r.summaryJson as unknown as TaxPlanningRunSummary)?.endingAssets ?? 0,
      hasRothConversion: !!config?.rothConversion,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function getTaxPlanningRun(
  runId: string,
  householdId: string
): Promise<TaxPlanningRunResult | null> {
  const run = await prisma.taxPlanningRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });
  if (!run) return null;

  return {
    runId: run.id,
    householdId: run.householdId,
    scenarioId: run.scenarioId,
    scenarioName: run.scenario?.name ?? '(No scenario)',
    label: run.label ?? 'Tax Analysis',
    createdAt: run.createdAt.toISOString(),
    taxAssumptions: run.taxConfigJson as unknown as TaxAssumptions,
    summary: run.summaryJson as unknown as TaxPlanningRunSummary,
    yearByYear: run.yearlyJson as unknown as TaxPlanningYearResult[],
  };
}
