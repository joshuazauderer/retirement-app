/**
 * reportDataAssemblyService — assembles report view models from persisted DB data.
 * No planning math re-execution. All data comes from stored run records.
 */
import { prisma } from '@/lib/prisma';
import type {
  ReportType,
  ReportViewModel,
  ReportMetadata,
  AssumptionSnapshot,
  ReportValidation,
} from './types';
import { REPORT_DEFINITIONS } from './reportDefinitionService';
import { REPORT_LIMITATIONS } from './reportRenderService';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export async function validateReportRequest(
  reportType: ReportType,
  householdId: string,
  sourceRunId: string | undefined,
  userId: string,
): Promise<ReportValidation> {
  const errors: string[] = [];
  const def = REPORT_DEFINITIONS[reportType];

  // Verify household belongs to user
  const household = await prisma.household.findFirst({
    where: { id: householdId, primaryUserId: userId },
  });
  if (!household) {
    errors.push('Household not found or access denied');
    return { valid: false, errors };
  }

  if (def.requiresRunId && !sourceRunId) {
    errors.push('A source run ID is required for this report type');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// HOUSEHOLD_SUMMARY
// ---------------------------------------------------------------------------

export async function assembleHouseholdSummaryReport(
  householdId: string,
): Promise<ReportViewModel> {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: {
      members: true,
      assetAccounts: true,
      scenarios: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!household) throw new Error('Household not found');

  const primary = household.members.find(
    (m: { relationshipType: string }) => m.relationshipType === 'PRIMARY',
  );
  const spouse = household.members.find(
    (m: { relationshipType: string }) => m.relationshipType === 'SPOUSE',
  );

  // Compute current ages from dateOfBirth
  const currentYear = new Date().getFullYear();
  const primaryAge = primary
    ? currentYear - new Date(primary.dateOfBirth).getFullYear()
    : undefined;
  const spouseAge = spouse
    ? currentYear - new Date(spouse.dateOfBirth).getFullYear()
    : undefined;

  const totalBalance = household.assetAccounts.reduce(
    (sum: number, a: { currentBalance: { toNumber?: () => number } | number }) => {
      const bal = typeof a.currentBalance === 'object' && a.currentBalance !== null && 'toNumber' in a.currentBalance
        ? (a.currentBalance as { toNumber: () => number }).toNumber()
        : Number(a.currentBalance);
      return sum + bal;
    },
    0,
  );

  const metadata: ReportMetadata = {
    reportType: 'HOUSEHOLD_SUMMARY',
    title: 'Household Retirement Summary',
    generatedAt: new Date().toISOString(),
    householdId,
  };

  const assumptions: AssumptionSnapshot = {
    runDate: new Date().toISOString(),
    additionalNotes: ['Based on current household data as of report generation date'],
  };

  return {
    metadata,
    assumptions,
    sections: [
      {
        title: 'Household Profile',
        content: `${household.members.length} members, ${household.assetAccounts.length} accounts, ${household.scenarios.length} scenarios.`,
      },
    ],
    summaryCards: [
      { label: 'Primary Age', value: primaryAge != null ? String(primaryAge) : '—' },
      { label: 'Spouse Age', value: spouseAge != null ? String(spouseAge) : 'N/A' },
      { label: 'Total Accounts', value: String(household.assetAccounts.length) },
      { label: 'Total Balance', value: `$${Math.round(totalBalance).toLocaleString()}` },
      { label: 'Scenarios', value: String(household.scenarios.length) },
    ],
    limitations: REPORT_LIMITATIONS,
  };
}

// ---------------------------------------------------------------------------
// TAX_PLANNING
// ---------------------------------------------------------------------------

export async function assembleTaxPlanningReport(
  runId: string,
  householdId: string,
): Promise<ReportViewModel> {
  const run = await prisma.taxPlanningRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });

  if (!run) throw new Error('Tax planning run not found');

  const yearlyData = run.yearlyJson as unknown as Array<Record<string, number>>;
  const configData = run.taxConfigJson as unknown as Record<string, unknown>;

  const totalFederalTax =
    typeof run.totalFederalTax === 'object' && run.totalFederalTax !== null && 'toNumber' in run.totalFederalTax
      ? (run.totalFederalTax as { toNumber: () => number }).toNumber()
      : Number(run.totalFederalTax);
  const totalStateTax =
    typeof run.totalStateTax === 'object' && run.totalStateTax !== null && 'toNumber' in run.totalStateTax
      ? (run.totalStateTax as { toNumber: () => number }).toNumber()
      : Number(run.totalStateTax);
  const totalLifetimeTax =
    typeof run.totalLifetimeTax === 'object' && run.totalLifetimeTax !== null && 'toNumber' in run.totalLifetimeTax
      ? (run.totalLifetimeTax as { toNumber: () => number }).toNumber()
      : Number(run.totalLifetimeTax);

  const metadata: ReportMetadata = {
    reportType: 'TAX_PLANNING',
    title: 'Tax Planning Report',
    generatedAt: new Date().toISOString(),
    householdId,
    sourceRunId: runId,
    label: run.label ?? undefined,
  };

  const assumptions: AssumptionSnapshot = {
    scenarioName: run.scenario?.name,
    runDate: run.createdAt.toISOString(),
    additionalNotes: [
      `Filing status: ${String(configData?.filingStatus ?? '—')}`,
      `State: ${String(configData?.stateCode ?? '—')}`,
    ],
  };

  const yearByYearHeaders = ['Year', 'Federal Tax', 'State Tax', 'SS Taxable', 'Cap Gains', 'Total Tax', 'Ending Assets'];
  const yearByYearRows = (yearlyData ?? []).map((yr) => ({
    Year: yr.year,
    'Federal Tax': yr.federalTax != null ? `$${Math.round(yr.federalTax).toLocaleString()}` : '—',
    'State Tax': yr.stateTax != null ? `$${Math.round(yr.stateTax).toLocaleString()}` : '—',
    'SS Taxable': yr.ssTaxableAmount != null ? `$${Math.round(yr.ssTaxableAmount).toLocaleString()}` : '—',
    'Cap Gains': yr.capitalGainsTax != null ? `$${Math.round(yr.capitalGainsTax).toLocaleString()}` : '—',
    'Total Tax': yr.totalTax != null ? `$${Math.round(yr.totalTax).toLocaleString()}` : '—',
    'Ending Assets': yr.endingAssets != null ? `$${Math.round(yr.endingAssets).toLocaleString()}` : '—',
  }));

  return {
    metadata,
    assumptions,
    sections: [
      {
        title: 'Tax Run Overview',
        content: `Scenario: ${run.scenario?.name ?? 'Unknown'}. Run date: ${run.createdAt.toLocaleDateString()}. Label: ${run.label ?? '—'}.`,
      },
    ],
    summaryCards: [
      { label: 'Total Federal Tax', value: `$${Math.round(totalFederalTax).toLocaleString()}` },
      { label: 'Total State Tax', value: `$${Math.round(totalStateTax).toLocaleString()}` },
      { label: 'Total Lifetime Tax', value: `$${Math.round(totalLifetimeTax).toLocaleString()}` },
      {
        label: 'Plan Status',
        value: run.success ? 'Fully Funded' : `Depleted ${run.firstDepletionYear ?? ''}`,
      },
    ],
    yearByYearHeaders,
    yearByYearRows,
    limitations: REPORT_LIMITATIONS,
  };
}

// ---------------------------------------------------------------------------
// HEALTHCARE_LONGEVITY
// ---------------------------------------------------------------------------

export async function assembleHealthcareLongevityReport(
  runId: string,
  householdId: string,
): Promise<ReportViewModel> {
  const run = await prisma.healthcarePlanningRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });

  if (!run) throw new Error('Healthcare planning run not found');

  const yearlyData = run.yearlyJson as unknown as Array<Record<string, unknown>>;
  const summaryData = run.summaryJson as unknown as Record<string, number | boolean | undefined>;

  const metadata: ReportMetadata = {
    reportType: 'HEALTHCARE_LONGEVITY',
    title: 'Healthcare & Longevity Report',
    generatedAt: new Date().toISOString(),
    householdId,
    sourceRunId: runId,
    label: run.label,
  };

  const assumptions: AssumptionSnapshot = {
    scenarioName: run.scenario?.name,
    runDate: run.createdAt.toISOString(),
    additionalNotes: [
      `LTC Stress: ${run.hasLtcStress ? 'Enabled' : 'Disabled'}`,
      `Longevity Stress: ${run.hasLongevityStress ? `To age ${run.longevityTargetAge}` : 'Disabled'}`,
    ],
  };

  const yearByYearHeaders = [
    'Year', 'Age', 'Pre-Medicare Cost', 'Medicare Cost', 'LTC Cost',
    'Total Healthcare Cost', 'Ending Assets',
  ];
  const yearByYearRows = (yearlyData ?? []).map((yr) => ({
    Year: Number(yr.year),
    Age: Number(yr.age),
    'Pre-Medicare Cost': `$${Math.round(Number(yr.primaryPreMedicareCost ?? 0) + Number(yr.spousePreMedicareCost ?? 0)).toLocaleString()}`,
    'Medicare Cost': `$${Math.round(Number(yr.primaryMedicareCost ?? 0) + Number(yr.spouseMedicareCost ?? 0)).toLocaleString()}`,
    'LTC Cost': `$${Math.round(Number(yr.ltcCost ?? 0)).toLocaleString()}`,
    'Total Healthcare Cost': `$${Math.round(Number(yr.totalHealthcareCost ?? 0)).toLocaleString()}`,
    'Ending Assets': `$${Math.round(Number(yr.endingAssets ?? 0)).toLocaleString()}`,
  }));

  const totalPreMedicare = Number(summaryData?.totalPreMedicareCost ?? 0);
  const totalMedicare = Number(summaryData?.totalMedicareCost ?? 0);
  const totalLtc = Number(summaryData?.totalLtcCost ?? 0);
  const peak = Number(summaryData?.peakAnnualHealthcareCost ?? 0);

  return {
    metadata,
    assumptions,
    sections: [
      {
        title: 'Healthcare Overview',
        content: `Scenario: ${run.scenario?.name ?? 'Unknown'}. Label: ${run.label}. LTC stress: ${run.hasLtcStress ? 'Yes' : 'No'}. Longevity stress: ${run.hasLongevityStress ? `To age ${run.longevityTargetAge}` : 'No'}.`,
      },
    ],
    summaryCards: [
      { label: 'Total Healthcare Cost', value: `$${Math.round(run.totalHealthcareCost).toLocaleString()}` },
      { label: 'Pre-Medicare Costs', value: `$${Math.round(totalPreMedicare).toLocaleString()}` },
      { label: 'Medicare-Era Costs', value: `$${Math.round(totalMedicare).toLocaleString()}` },
      { label: 'LTC Stress Costs', value: `$${Math.round(totalLtc).toLocaleString()}` },
      { label: 'Peak Annual Cost', value: `$${Math.round(peak).toLocaleString()}` },
      {
        label: 'Plan Status',
        value: run.success ? 'Fully Funded' : `Depleted ${run.firstDepletionYear ?? ''}`,
      },
    ],
    yearByYearHeaders,
    yearByYearRows,
    limitations: REPORT_LIMITATIONS,
  };
}

// ---------------------------------------------------------------------------
// HOUSING_LEGACY
// ---------------------------------------------------------------------------

export async function assembleHousingLegacyReport(
  runId: string,
  householdId: string,
): Promise<ReportViewModel> {
  const run = await prisma.housingPlanningRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });

  if (!run) throw new Error('Housing planning run not found');

  const yearlyData = run.yearlyJson as unknown as Array<Record<string, unknown>>;
  const summaryData = run.summaryJson as unknown as Record<string, unknown>;
  const legacyData = run.legacyJson as unknown as Record<string, unknown> | null;

  const metadata: ReportMetadata = {
    reportType: 'HOUSING_LEGACY',
    title: 'Housing & Legacy Report',
    generatedAt: new Date().toISOString(),
    householdId,
    sourceRunId: runId,
    label: run.label,
  };

  const assumptions: AssumptionSnapshot = {
    scenarioName: run.scenario?.name,
    runDate: run.createdAt.toISOString(),
    additionalNotes: [`Strategy: ${run.strategy}`],
  };

  const legacyProjection = legacyData as Record<string, number> | null;

  const yearByYearHeaders = [
    'Year', 'Age', 'Housing Expense', 'Mortgage Payment', 'Gifting',
    'Total Cost', 'Home Equity', 'Ending Assets',
  ];
  const yearByYearRows = (yearlyData ?? []).map((yr) => ({
    Year: Number(yr.year),
    Age: Number(yr.age),
    'Housing Expense': `$${Math.round(Number(yr.housingExpense ?? 0)).toLocaleString()}`,
    'Mortgage Payment': `$${Math.round(Number(yr.mortgagePayment ?? 0)).toLocaleString()}`,
    Gifting: `$${Math.round(Number(yr.giftingAmount ?? 0)).toLocaleString()}`,
    'Total Cost': `$${Math.round(Number(yr.totalHousingAndGiftCost ?? 0)).toLocaleString()}`,
    'Home Equity': `$${Math.round(Number(yr.homeEquity ?? 0)).toLocaleString()}`,
    'Ending Assets': `$${Math.round(Number(yr.endingAssets ?? 0)).toLocaleString()}`,
  }));

  const netEquityReleased = run.netReleasedEquity;
  const endingAssets = run.endingFinancialAssets;
  const netEstateValue = run.projectedNetEstate;
  const totalLifetimeHousingCosts = Number(summaryData?.totalLifetimeHousingCosts ?? 0);

  return {
    metadata,
    assumptions,
    sections: [
      {
        title: 'Housing Strategy Overview',
        content: `Strategy: ${run.strategy}. Scenario: ${run.scenario?.name ?? 'Unknown'}.`,
      },
    ],
    summaryCards: [
      { label: 'Strategy', value: run.strategy.replace(/_/g, ' ') },
      { label: 'Net Equity Released', value: `$${Math.round(netEquityReleased).toLocaleString()}` },
      { label: 'Ending Assets', value: `$${Math.round(endingAssets).toLocaleString()}` },
      { label: 'Net Estate Value', value: `$${Math.round(netEstateValue).toLocaleString()}` },
      { label: 'Total Lifetime Housing', value: `$${Math.round(totalLifetimeHousingCosts).toLocaleString()}` },
      {
        label: 'Plan Status',
        value: run.success ? 'Fully Funded' : `Depleted ${run.firstDepletionYear ?? ''}`,
      },
      ...(legacyProjection
        ? [
            {
              label: 'Financial Assets (Legacy)',
              value: `$${Math.round(legacyProjection.endingFinancialAssets ?? 0).toLocaleString()}`,
            },
            {
              label: 'Real Estate Equity (Legacy)',
              value: `$${Math.round(legacyProjection.endingRealEstateEquity ?? 0).toLocaleString()}`,
            },
          ]
        : []),
    ],
    yearByYearHeaders,
    yearByYearRows,
    limitations: REPORT_LIMITATIONS,
  };
}

// ---------------------------------------------------------------------------
// MONTE_CARLO_SUMMARY
// ---------------------------------------------------------------------------

export async function assembleMonteCarloReport(
  runId: string,
  householdId: string,
): Promise<ReportViewModel> {
  const run = await prisma.monteCarloRun.findFirst({
    where: { id: runId, householdId },
    include: { scenario: { select: { name: true } } },
  });

  if (!run) throw new Error('Monte Carlo run not found');

  const toNum = (v: unknown) =>
    typeof v === 'object' && v !== null && 'toNumber' in v
      ? (v as { toNumber: () => number }).toNumber()
      : Number(v);

  const successProbability = toNum(run.successProbability);
  const medianEndingAssets = toNum(run.medianEndingAssets);
  const p10EndingAssets = toNum(run.p10EndingAssets);
  const p90EndingAssets = toNum(run.p90EndingAssets);

  const metadata: ReportMetadata = {
    reportType: 'MONTE_CARLO_SUMMARY',
    title: 'Monte Carlo Simulation Summary',
    generatedAt: new Date().toISOString(),
    householdId,
    sourceRunId: runId,
    label: run.label ?? undefined,
  };

  const assumptions: AssumptionSnapshot = {
    scenarioName: run.scenario?.name,
    runDate: run.createdAt.toISOString(),
    additionalNotes: [
      `Simulations: ${run.simulationCount.toLocaleString()}`,
      `Engine version: ${run.engineVersion}`,
      `Projection: ${run.projectionStartYear}–${run.projectionEndYear}`,
    ],
  };

  return {
    metadata,
    assumptions,
    sections: [
      {
        title: 'Monte Carlo Overview',
        content: `Ran ${run.simulationCount.toLocaleString()} simulations. Success probability: ${(successProbability * 100).toFixed(0)}%.`,
      },
    ],
    summaryCards: [
      { label: 'Success Probability', value: `${(successProbability * 100).toFixed(0)}%` },
      { label: 'Median Ending Balance', value: `$${Math.round(medianEndingAssets).toLocaleString()}` },
      { label: 'P10 Ending Balance', value: `$${Math.round(p10EndingAssets).toLocaleString()}` },
      { label: 'P90 Ending Balance', value: `$${Math.round(p90EndingAssets).toLocaleString()}` },
      { label: 'Median Depletion Year', value: run.medianDepletionYear ? String(run.medianDepletionYear) : 'None' },
      { label: 'Simulations Run', value: run.simulationCount.toLocaleString() },
    ],
    limitations: REPORT_LIMITATIONS,
  };
}
