import type { ReportType } from './types';

export interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  requiresRunId: boolean;
  supportsComparison: boolean;
  supportsCsv: boolean;
  requiredSourceType: string;    // Which DB table/model provides data
}

export const REPORT_DEFINITIONS: Record<ReportType, ReportDefinition> = {
  HOUSEHOLD_SUMMARY: {
    type: 'HOUSEHOLD_SUMMARY',
    title: 'Household Retirement Summary',
    description: 'High-level household profile and key projected outcomes across all planning runs.',
    requiresRunId: false,
    supportsComparison: false,
    supportsCsv: false,
    requiredSourceType: 'household',
  },
  SCENARIO_SUMMARY: {
    type: 'SCENARIO_SUMMARY',
    title: 'Scenario Summary Report',
    description: 'Summary of a selected planning scenario with key assumptions and outcomes.',
    requiresRunId: true,
    supportsComparison: false,
    supportsCsv: true,
    requiredSourceType: 'scenario',
  },
  SCENARIO_COMPARISON: {
    type: 'SCENARIO_COMPARISON',
    title: 'Scenario Comparison Report',
    description: 'Side-by-side comparison of two planning scenarios.',
    requiresRunId: true,
    supportsComparison: true,
    supportsCsv: false,
    requiredSourceType: 'scenario',
  },
  MONTE_CARLO_SUMMARY: {
    type: 'MONTE_CARLO_SUMMARY',
    title: 'Monte Carlo Simulation Summary',
    description: 'Probability-based outcomes from a Monte Carlo simulation run.',
    requiresRunId: true,
    supportsComparison: false,
    supportsCsv: true,
    requiredSourceType: 'monteCarloRun',
  },
  TAX_PLANNING: {
    type: 'TAX_PLANNING',
    title: 'Tax Planning Report',
    description: 'Annual and lifetime tax summary from a tax-aware projection run.',
    requiresRunId: true,
    supportsComparison: false,
    supportsCsv: true,
    requiredSourceType: 'taxPlanningRun',
  },
  HEALTHCARE_LONGEVITY: {
    type: 'HEALTHCARE_LONGEVITY',
    title: 'Healthcare & Longevity Report',
    description: 'Healthcare cost projection and longevity stress testing summary.',
    requiresRunId: true,
    supportsComparison: false,
    supportsCsv: true,
    requiredSourceType: 'healthcarePlanningRun',
  },
  HOUSING_LEGACY: {
    type: 'HOUSING_LEGACY',
    title: 'Housing & Legacy Report',
    description: 'Housing strategy analysis and projected estate/legacy value.',
    requiresRunId: true,
    supportsComparison: false,
    supportsCsv: true,
    requiredSourceType: 'housingPlanningRun',
  },
};

export function getReportDefinition(type: ReportType): ReportDefinition {
  return REPORT_DEFINITIONS[type];
}

export function listReportDefinitions(): ReportDefinition[] {
  return Object.values(REPORT_DEFINITIONS);
}
