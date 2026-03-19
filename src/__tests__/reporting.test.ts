import { describe, test, expect } from 'vitest';
import {
  listReportDefinitions,
  getReportDefinition,
  REPORT_DEFINITIONS,
} from '../server/reports/reportDefinitionService';
import {
  formatCurrency,
  formatPercent,
  formatAge,
  formatYear,
  formatDepletionYear,
  formatSuccessRate,
  formatReportDate,
  formatReportTimestamp,
  getReportTypeLabel,
  REPORT_LIMITATIONS,
} from '../server/reports/reportRenderService';
import {
  generateYearByYearCsv,
  generateComparisonCsv,
  generateSummaryCardsCsv,
} from '../server/reports/csvExportService';
import { assembleComparisonReport } from '../server/reports/reportComparisonService';
import type { ReportViewModel } from '../server/reports/types';

// ---------------------------------------------------------------------------
// 1. reportDefinitionService
// ---------------------------------------------------------------------------

describe('reportDefinitionService', () => {
  test('listReportDefinitions returns all 7 types', () => {
    const defs = listReportDefinitions();
    expect(defs).toHaveLength(7);
  });

  test('getReportDefinition returns correct definition for TAX_PLANNING', () => {
    const def = getReportDefinition('TAX_PLANNING');
    expect(def.type).toBe('TAX_PLANNING');
    expect(def.title).toBe('Tax Planning Report');
    expect(def.supportsCsv).toBe(true);
  });

  test('getReportDefinition returns correct definition for HOUSEHOLD_SUMMARY', () => {
    const def = getReportDefinition('HOUSEHOLD_SUMMARY');
    expect(def.type).toBe('HOUSEHOLD_SUMMARY');
    expect(def.requiresRunId).toBe(false);
    expect(def.supportsComparison).toBe(false);
  });

  test('requiresRunId is correct for each type', () => {
    expect(REPORT_DEFINITIONS['HOUSEHOLD_SUMMARY'].requiresRunId).toBe(false);
    expect(REPORT_DEFINITIONS['SCENARIO_SUMMARY'].requiresRunId).toBe(true);
    expect(REPORT_DEFINITIONS['SCENARIO_COMPARISON'].requiresRunId).toBe(true);
    expect(REPORT_DEFINITIONS['MONTE_CARLO_SUMMARY'].requiresRunId).toBe(true);
    expect(REPORT_DEFINITIONS['TAX_PLANNING'].requiresRunId).toBe(true);
    expect(REPORT_DEFINITIONS['HEALTHCARE_LONGEVITY'].requiresRunId).toBe(true);
    expect(REPORT_DEFINITIONS['HOUSING_LEGACY'].requiresRunId).toBe(true);
  });

  test('supportsComparison is only true for SCENARIO_COMPARISON', () => {
    const defs = listReportDefinitions();
    const comparisonTypes = defs.filter((d) => d.supportsComparison).map((d) => d.type);
    expect(comparisonTypes).toEqual(['SCENARIO_COMPARISON']);
  });

  test('all definitions have non-empty title and description', () => {
    const defs = listReportDefinitions();
    for (const def of defs) {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. reportRenderService formatting helpers
// ---------------------------------------------------------------------------

describe('reportRenderService', () => {
  test('formatCurrency basic', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
  });

  test('formatCurrency large number', () => {
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });

  test('formatCurrency rounds fractional', () => {
    expect(formatCurrency(1500.75)).toBe('$1,501');
  });

  test('formatPercent default 1 decimal', () => {
    expect(formatPercent(0.075)).toBe('7.5%');
  });

  test('formatPercent 2 decimals', () => {
    expect(formatPercent(0.1234, 2)).toBe('12.34%');
  });

  test('formatPercent zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  test('formatAge', () => {
    expect(formatAge(65)).toBe('Age 65');
  });

  test('formatYear', () => {
    expect(formatYear(2045)).toBe('2045');
  });

  test('formatDepletionYear with year', () => {
    expect(formatDepletionYear(2045)).toBe('Depleted 2045');
  });

  test('formatDepletionYear with undefined', () => {
    expect(formatDepletionYear(undefined)).toBe('Fully Funded');
  });

  test('formatDepletionYear with null', () => {
    expect(formatDepletionYear(null)).toBe('Fully Funded');
  });

  test('formatSuccessRate', () => {
    expect(formatSuccessRate(0.85)).toBe('85% success');
  });

  test('formatSuccessRate rounds down', () => {
    expect(formatSuccessRate(0.856)).toBe('86% success');
  });

  test('formatReportDate returns human readable date', () => {
    const result = formatReportDate('2025-06-15T00:00:00.000Z');
    expect(result).toContain('2025');
    expect(result).toContain('June');
  });

  test('formatReportTimestamp returns date and time', () => {
    const result = formatReportTimestamp('2025-06-15T14:30:00.000Z');
    expect(result).toContain('2025');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('formatReportDate handles invalid string gracefully', () => {
    const result = formatReportDate('not-a-date');
    expect(typeof result).toBe('string');
  });

  test('getReportTypeLabel TAX_PLANNING', () => {
    expect(getReportTypeLabel('TAX_PLANNING')).toBe('Tax Planning');
  });

  test('getReportTypeLabel HOUSEHOLD_SUMMARY', () => {
    expect(getReportTypeLabel('HOUSEHOLD_SUMMARY')).toBe('Household Summary');
  });

  test('getReportTypeLabel HEALTHCARE_LONGEVITY', () => {
    expect(getReportTypeLabel('HEALTHCARE_LONGEVITY')).toBe('Healthcare & Longevity');
  });

  test('getReportTypeLabel unknown type returns type string', () => {
    expect(getReportTypeLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
  });
});

// ---------------------------------------------------------------------------
// 3. csvExportService
// ---------------------------------------------------------------------------

const makeTaxViewModel = (): ReportViewModel => ({
  metadata: {
    reportType: 'TAX_PLANNING',
    title: 'Tax Planning Report',
    generatedAt: new Date().toISOString(),
    householdId: 'hh1',
    sourceRunId: 'run1',
  },
  assumptions: { runDate: new Date().toISOString() },
  sections: [],
  summaryCards: [
    { label: 'Total Federal Tax', value: '$50,000' },
    { label: 'Total State Tax', value: '$10,000' },
  ],
  yearByYearHeaders: ['Year', 'Federal Tax', 'State Tax', 'SS Taxable', 'Cap Gains', 'Total Tax', 'Ending Assets'],
  yearByYearRows: [
    { Year: 2025, 'Federal Tax': '$5,000', 'State Tax': '$1,000', 'SS Taxable': '$0', 'Cap Gains': '$0', 'Total Tax': '$6,000', 'Ending Assets': '$500,000' },
    { Year: 2026, 'Federal Tax': '$5,200', 'State Tax': '$1,040', 'SS Taxable': '$2,000', 'Cap Gains': '$500', 'Total Tax': '$6,240', 'Ending Assets': '$490,000' },
  ],
  limitations: REPORT_LIMITATIONS,
});

const makeHealthcareViewModel = (): ReportViewModel => ({
  metadata: {
    reportType: 'HEALTHCARE_LONGEVITY',
    title: 'Healthcare & Longevity Report',
    generatedAt: new Date().toISOString(),
    householdId: 'hh1',
    sourceRunId: 'run2',
  },
  assumptions: { runDate: new Date().toISOString() },
  sections: [],
  summaryCards: [{ label: 'Total Healthcare Cost', value: '$250,000' }],
  yearByYearHeaders: ['Year', 'Age', 'Pre-Medicare Cost', 'Medicare Cost', 'LTC Cost', 'Total Healthcare Cost', 'Ending Assets'],
  yearByYearRows: [
    { Year: 2025, Age: 65, 'Pre-Medicare Cost': '$3,000', 'Medicare Cost': '$0', 'LTC Cost': '$0', 'Total Healthcare Cost': '$3,000', 'Ending Assets': '$800,000' },
  ],
  limitations: REPORT_LIMITATIONS,
});

const makeHousingViewModel = (): ReportViewModel => ({
  metadata: {
    reportType: 'HOUSING_LEGACY',
    title: 'Housing & Legacy Report',
    generatedAt: new Date().toISOString(),
    householdId: 'hh1',
    sourceRunId: 'run3',
  },
  assumptions: { runDate: new Date().toISOString() },
  sections: [],
  summaryCards: [{ label: 'Strategy', value: 'stay in place' }],
  yearByYearHeaders: ['Year', 'Age', 'Housing Expense', 'Mortgage Payment', 'Gifting', 'Total Cost', 'Home Equity', 'Ending Assets'],
  yearByYearRows: [
    { Year: 2025, Age: 65, 'Housing Expense': '$12,000', 'Mortgage Payment': '$0', Gifting: '$0', 'Total Cost': '$12,000', 'Home Equity': '$400,000', 'Ending Assets': '$700,000' },
  ],
  limitations: REPORT_LIMITATIONS,
});

describe('csvExportService', () => {
  test('generateYearByYearCsv with data returns correct row count', () => {
    const vm = makeTaxViewModel();
    const result = generateYearByYearCsv(vm, 'tax-report');
    expect(result.rowCount).toBe(2);
    expect(result.filename).toBe('tax-report.csv');
  });

  test('generateYearByYearCsv with data contains header line', () => {
    const vm = makeTaxViewModel();
    const result = generateYearByYearCsv(vm, 'tax-report');
    const lines = result.content.split('\n');
    expect(lines[0]).toBe('Year,Federal Tax,State Tax,SS Taxable,Cap Gains,Total Tax,Ending Assets');
  });

  test('generateYearByYearCsv with empty data returns 0 rows', () => {
    const vm = makeTaxViewModel();
    vm.yearByYearRows = [];
    const result = generateYearByYearCsv(vm, 'empty');
    expect(result.rowCount).toBe(0);
    expect(result.content).toBe('No data available');
  });

  test('generateYearByYearCsv preserves filename with .csv extension', () => {
    const vm = makeTaxViewModel();
    const result = generateYearByYearCsv(vm, 'myfile.csv');
    expect(result.filename).toBe('myfile.csv');
  });

  test('Tax planning CSV has correct headers', () => {
    const vm = makeTaxViewModel();
    const result = generateYearByYearCsv(vm, 'tax');
    const firstLine = result.content.split('\n')[0];
    expect(firstLine).toContain('Year');
    expect(firstLine).toContain('Federal Tax');
    expect(firstLine).toContain('State Tax');
    expect(firstLine).toContain('Total Tax');
    expect(firstLine).toContain('Ending Assets');
  });

  test('Healthcare CSV has correct headers', () => {
    const vm = makeHealthcareViewModel();
    const result = generateYearByYearCsv(vm, 'healthcare');
    const firstLine = result.content.split('\n')[0];
    expect(firstLine).toContain('Year');
    expect(firstLine).toContain('Age');
    expect(firstLine).toContain('Pre-Medicare Cost');
    expect(firstLine).toContain('Medicare Cost');
    expect(firstLine).toContain('LTC Cost');
    expect(firstLine).toContain('Total Healthcare Cost');
  });

  test('Housing CSV has correct headers', () => {
    const vm = makeHousingViewModel();
    const result = generateYearByYearCsv(vm, 'housing');
    const firstLine = result.content.split('\n')[0];
    expect(firstLine).toContain('Year');
    expect(firstLine).toContain('Housing Expense');
    expect(firstLine).toContain('Home Equity');
    expect(firstLine).toContain('Ending Assets');
  });

  test('generateComparisonCsv with comparison rows', () => {
    const vm = makeTaxViewModel();
    vm.comparisonRows = [
      { label: 'Total Federal Tax', a: '$50,000', b: '$55,000', delta: '+$5,000', direction: 'worse' },
      { label: 'Plan Status', a: 'Fully Funded', b: 'Fully Funded' },
    ];
    const result = generateComparisonCsv(vm, 'comparison');
    expect(result.rowCount).toBe(2);
    const lines = result.content.split('\n');
    expect(lines[0]).toBe('Metric,Plan A,Plan B,Delta');
  });

  test('Comparison CSV has Label, Plan A, Plan B, Delta headers', () => {
    const vm = makeTaxViewModel();
    vm.comparisonRows = [{ label: 'Test Metric', a: '$100', b: '$200' }];
    const result = generateComparisonCsv(vm, 'comp');
    const firstLine = result.content.split('\n')[0];
    expect(firstLine).toContain('Metric');
    expect(firstLine).toContain('Plan A');
    expect(firstLine).toContain('Plan B');
    expect(firstLine).toContain('Delta');
  });

  test('generateComparisonCsv empty returns 0 rows', () => {
    const vm = makeTaxViewModel();
    vm.comparisonRows = [];
    const result = generateComparisonCsv(vm, 'empty-comparison');
    expect(result.rowCount).toBe(0);
  });

  test('generateSummaryCardsCsv with cards', () => {
    const vm = makeTaxViewModel();
    const result = generateSummaryCardsCsv(vm, 'summary');
    expect(result.rowCount).toBe(2);
    const lines = result.content.split('\n');
    expect(lines[0]).toBe('Metric,Value');
    expect(lines[1]).toContain('Total Federal Tax');
    expect(lines[1]).toContain('$50,000');
  });

  test('CSV escaping of values with commas', () => {
    const vm = makeTaxViewModel();
    vm.summaryCards = [{ label: 'Label, With Comma', value: '$1,000' }];
    const result = generateSummaryCardsCsv(vm, 'escape-test');
    expect(result.content).toContain('"Label, With Comma"');
    expect(result.content).toContain('"$1,000"');
  });

  test('CSV escaping of values with double quotes', () => {
    const vm = makeTaxViewModel();
    vm.summaryCards = [{ label: 'Label "Quoted"', value: 'value' }];
    const result = generateSummaryCardsCsv(vm, 'quote-test');
    expect(result.content).toContain('"Label ""Quoted"""');
  });
});

// ---------------------------------------------------------------------------
// 4. reportComparisonService
// ---------------------------------------------------------------------------

describe('reportComparisonService', () => {
  const makeVm = (label: string, runId: string): ReportViewModel => ({
    metadata: {
      reportType: 'TAX_PLANNING',
      title: 'Tax Planning Report',
      generatedAt: new Date().toISOString(),
      householdId: 'hh1',
      sourceRunId: runId,
      label,
    },
    assumptions: {},
    sections: [{ title: 'Overview', content: `Content for ${label}` }],
    summaryCards: [
      { label: 'Total Federal Tax', value: '$50,000' },
      { label: 'Plan Status', value: 'Fully Funded' },
    ],
    limitations: REPORT_LIMITATIONS,
  });

  test('assembleComparisonReport merges summaryCards correctly', async () => {
    const vmA = makeVm('Run A', 'runA');
    const vmB = makeVm('Run B', 'runB');
    vmB.summaryCards = [
      { label: 'Total Federal Tax', value: '$55,000' },
      { label: 'Plan Status', value: 'Depleted 2042' },
    ];

    const result = await assembleComparisonReport(vmA, vmB);
    expect(result.comparisonRows).toBeDefined();
    expect(result.comparisonRows!.length).toBe(2);

    const taxRow = result.comparisonRows!.find((r) => r.label === 'Total Federal Tax');
    expect(taxRow?.a).toBe('$50,000');
    expect(taxRow?.b).toBe('$55,000');
  });

  test('assembleComparisonReport sets correct report type', async () => {
    const vmA = makeVm('Run A', 'runA');
    const vmB = makeVm('Run B', 'runB');
    const result = await assembleComparisonReport(vmA, vmB);
    expect(result.metadata.reportType).toBe('SCENARIO_COMPARISON');
  });

  test('assembleComparisonReport includes both section contents', async () => {
    const vmA = makeVm('Run A', 'runA');
    const vmB = makeVm('Run B', 'runB');
    const result = await assembleComparisonReport(vmA, vmB);
    expect(result.sections.length).toBe(2);
    expect(result.sections[0].title).toBe('Run A');
    expect(result.sections[1].title).toBe('Run B');
  });

  test('assembleComparisonReport sets secondaryRunId', async () => {
    const vmA = makeVm('Run A', 'runA');
    const vmB = makeVm('Run B', 'runB');
    const result = await assembleComparisonReport(vmA, vmB);
    expect(result.metadata.secondaryRunId).toBe('runB');
  });

  test('assembleComparisonReport handles disjoint card sets', async () => {
    const vmA = makeVm('Run A', 'runA');
    const vmB = makeVm('Run B', 'runB');
    vmB.summaryCards = [
      { label: 'Different Metric', value: '$999' },
    ];
    const result = await assembleComparisonReport(vmA, vmB);
    const labels = result.comparisonRows!.map((r) => r.label);
    expect(labels).toContain('Total Federal Tax');
    expect(labels).toContain('Plan Status');
    expect(labels).toContain('Different Metric');
  });
});

// ---------------------------------------------------------------------------
// 5. REPORT_LIMITATIONS validation
// ---------------------------------------------------------------------------

describe('REPORT_LIMITATIONS', () => {
  test('is a non-empty array of strings', () => {
    expect(Array.isArray(REPORT_LIMITATIONS)).toBe(true);
    expect(REPORT_LIMITATIONS.length).toBeGreaterThan(0);
    for (const lim of REPORT_LIMITATIONS) {
      expect(typeof lim).toBe('string');
      expect(lim.length).toBeGreaterThan(0);
    }
  });

  test('includes planning-grade disclaimer', () => {
    const joined = REPORT_LIMITATIONS.join(' ').toLowerCase();
    expect(joined).toContain('planning');
  });
});

// ---------------------------------------------------------------------------
// 6. Golden cases
// ---------------------------------------------------------------------------

describe('Golden cases', () => {
  test('formatCurrency(1234567) returns $1,234,567', () => {
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });

  test('formatPercent(0.075) returns 7.5%', () => {
    expect(formatPercent(0.075)).toBe('7.5%');
  });

  test('formatDepletionYear(2045) returns Depleted 2045', () => {
    expect(formatDepletionYear(2045)).toBe('Depleted 2045');
  });

  test('formatDepletionYear(undefined) returns Fully Funded', () => {
    expect(formatDepletionYear(undefined)).toBe('Fully Funded');
  });

  test('Tax planning CSV row contains expected year data', () => {
    const vm = makeTaxViewModel();
    const result = generateYearByYearCsv(vm, 'tax');
    const lines = result.content.split('\n');
    expect(lines[1]).toContain('2025');
    expect(lines[1]).toContain('$5,000');
  });

  test('Healthcare CSV row count matches input', () => {
    const vm = makeHealthcareViewModel();
    const result = generateYearByYearCsv(vm, 'hc');
    expect(result.rowCount).toBe(1);
  });

  test('Housing CSV row contains home equity', () => {
    const vm = makeHousingViewModel();
    const result = generateYearByYearCsv(vm, 'housing');
    expect(result.content).toContain('$400,000');
  });

  test('Comparison CSV delta column appears for rows with delta', () => {
    const vm = makeTaxViewModel();
    vm.comparisonRows = [
      { label: 'Tax', a: '$50k', b: '$55k', delta: '+$5k', direction: 'worse' },
    ];
    const result = generateComparisonCsv(vm, 'comp');
    const dataLine = result.content.split('\n')[1];
    expect(dataLine).toContain('+$5k');
  });

  test('formatCurrency(0) returns $0', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  test('getReportTypeLabel for all known types returns non-empty string', () => {
    const types = [
      'HOUSEHOLD_SUMMARY', 'SCENARIO_SUMMARY', 'SCENARIO_COMPARISON',
      'MONTE_CARLO_SUMMARY', 'TAX_PLANNING', 'HEALTHCARE_LONGEVITY', 'HOUSING_LEGACY',
    ];
    for (const t of types) {
      const label = getReportTypeLabel(t);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(t); // should be human readable, not the raw type
    }
  });
});
