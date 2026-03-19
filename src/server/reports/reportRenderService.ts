/**
 * reportRenderService — format report view models for display.
 * Centralizes all formatting helpers for currency, percentages, dates, etc.
 */
import type { ReportViewModel } from './types';

export const REPORT_LIMITATIONS = [
  'Planning-grade estimates only — not legal, tax, medical, or investment advice.',
  'Outputs depend on accuracy of input assumptions and prior stored run quality.',
  'Annual time-step model; actual outcomes will differ.',
  'No AI-generated narrative.',
  'Consult qualified professionals for specific advice.',
];

// --- Formatting helpers ---

export function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export function formatPercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

export function formatAge(age: number): string {
  return `Age ${age}`;
}

export function formatYear(year: number): string {
  return String(year);
}

export function formatDepletionYear(firstDepletionYear: number | undefined | null): string {
  if (!firstDepletionYear) return 'Fully Funded';
  return `Depleted ${firstDepletionYear}`;
}

export function formatSuccessRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}% success`;
}

export function formatReportDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatReportTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Get a human-readable title for a report type.
 */
export function getReportTypeLabel(reportType: string): string {
  const labels: Record<string, string> = {
    HOUSEHOLD_SUMMARY: 'Household Summary',
    SCENARIO_SUMMARY: 'Scenario Summary',
    SCENARIO_COMPARISON: 'Scenario Comparison',
    MONTE_CARLO_SUMMARY: 'Monte Carlo Summary',
    TAX_PLANNING: 'Tax Planning',
    HEALTHCARE_LONGEVITY: 'Healthcare & Longevity',
    HOUSING_LEGACY: 'Housing & Legacy',
  };
  return labels[reportType] ?? reportType;
}

// Re-export for consumers that import from this module
export type { ReportViewModel };
