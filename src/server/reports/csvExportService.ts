/**
 * csvExportService — generate structured CSV exports from report view models.
 *
 * v1 Limitations:
 * - Simple string-based CSV generation; no streaming for very large datasets
 * - No Excel-specific formatting
 */
import type { ReportViewModel, CsvExportResult } from './types';

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a CSV from year-by-year report rows.
 */
export function generateYearByYearCsv(
  viewModel: ReportViewModel,
  filename: string,
): CsvExportResult {
  const headers = viewModel.yearByYearHeaders ?? [];
  const rows = viewModel.yearByYearRows ?? [];

  if (headers.length === 0 || rows.length === 0) {
    return { filename, content: 'No data available', rowCount: 0 };
  }

  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvValue(row[h] ?? '')).join(','),
  );

  const content = [headerLine, ...dataLines].join('\n');

  return {
    filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    content,
    rowCount: rows.length,
  };
}

/**
 * Generate a CSV from comparison rows.
 */
export function generateComparisonCsv(
  viewModel: ReportViewModel,
  filename: string,
): CsvExportResult {
  const rows = viewModel.comparisonRows ?? [];
  if (rows.length === 0) {
    return { filename, content: 'No comparison data available', rowCount: 0 };
  }

  const headers = ['Metric', 'Plan A', 'Plan B', 'Delta'];
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) =>
    [row.label, row.a, row.b, row.delta ?? '—'].map(escapeCsvValue).join(','),
  );

  const content = [headerLine, ...dataLines].join('\n');

  return {
    filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    content,
    rowCount: rows.length,
  };
}

/**
 * Generate summary cards as a simple two-column CSV.
 */
export function generateSummaryCardsCsv(
  viewModel: ReportViewModel,
  filename: string,
): CsvExportResult {
  const cards = viewModel.summaryCards;
  if (cards.length === 0) {
    return { filename, content: 'No summary data', rowCount: 0 };
  }

  const headerLine = 'Metric,Value';
  const dataLines = cards.map(
    (c) => `${escapeCsvValue(c.label)},${escapeCsvValue(c.value)}`,
  );
  const content = [headerLine, ...dataLines].join('\n');

  return {
    filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    content,
    rowCount: cards.length,
  };
}
