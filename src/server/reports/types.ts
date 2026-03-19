/**
 * Phase 12 — Reporting + Export + Print-Ready Retirement Plan Outputs
 *
 * LIMITATIONS (v1):
 * - Reports are planning-grade summaries, not legal/tax filing documents
 * - Exported outputs depend on prior stored simulation assumptions and run quality
 * - Print/PDF layouts optimized for readability, not custom publishing workflows
 * - No AI narrative generation
 * - No advisor collaboration workflow
 */

export type ReportType =
  | 'HOUSEHOLD_SUMMARY'
  | 'SCENARIO_SUMMARY'
  | 'SCENARIO_COMPARISON'
  | 'MONTE_CARLO_SUMMARY'
  | 'TAX_PLANNING'
  | 'HEALTHCARE_LONGEVITY'
  | 'HOUSING_LEGACY';

export type ExportFormat = 'PDF' | 'CSV' | 'PRINT';

export interface ReportRequest {
  householdId: string;
  reportType: ReportType;
  sourceRunId?: string;           // Primary run/scenario/analysis ID
  secondaryRunId?: string;        // For comparison reports
  exportFormat?: ExportFormat;
  label?: string;
}

export interface ReportMetadata {
  reportType: ReportType;
  title: string;
  generatedAt: string;            // ISO timestamp
  householdId: string;
  sourceRunId?: string;
  secondaryRunId?: string;
  label?: string;
}

export interface ReportSection {
  title: string;
  content: string;                // Description/summary text
  data?: Record<string, unknown>; // Structured data for rendering
}

export interface AssumptionSnapshot {
  retirementYear?: number;
  inflationRate?: number;
  returnAssumption?: number;
  scenarioName?: string;
  runDate?: string;
  additionalNotes?: string[];
}

export interface ReportViewModel {
  metadata: ReportMetadata;
  assumptions: AssumptionSnapshot;
  sections: ReportSection[];
  summaryCards: Array<{ label: string; value: string; note?: string }>;
  yearByYearRows?: Array<Record<string, string | number>>;
  yearByYearHeaders?: string[];
  comparisonRows?: Array<{ label: string; a: string; b: string; delta?: string; direction?: 'better' | 'worse' | 'neutral' }>;
  limitations: string[];
}

export interface CsvExportResult {
  filename: string;
  content: string;       // CSV string
  rowCount: number;
}

export interface ReportValidation {
  valid: boolean;
  errors: string[];
}

// Summary types for report assembly — lightweight versions of full run types
export interface HouseholdSummaryReportData {
  householdName: string;
  memberCount: number;
  primaryAge: number;
  spouseAge?: number;
  totalAccounts: number;
  totalBalance: number;
  scenarioCount: number;
  recentRunType?: string;
  recentRunDate?: string;
}

export interface ScenarioSummaryReportData {
  scenarioName: string;
  runDate: string;
  success: boolean;
  firstDepletionYear?: number;
  endingAssets: number;
  totalTax?: number;
  totalHealthcareCost?: number;
  netEstateValue?: number;
}

export interface MonteCarloReportData {
  runDate: string;
  simulationCount: number;
  successProbability: number;
  medianEndingBalance: number;
  p10EndingBalance: number;
  p90EndingBalance: number;
  medianDepletionYear?: number;
}

export interface TaxPlanningReportData {
  runDate: string;
  totalFederalTax: number;
  totalStateTax: number;
  totalLifetimeTax: number;
  firstDepletionYear?: number;
  success: boolean;
  scenarioName: string;
}

export interface HealthcareLongevityReportData {
  runDate: string;
  totalHealthcareCost: number;
  totalPreMedicareCost: number;
  totalMedicareCost: number;
  totalLtcCost: number;
  peakAnnualHealthcareCost: number;
  hasLtcStress: boolean;
  hasLongevityStress: boolean;
  longevityTargetAge?: number;
  endingAssets: number;
  success: boolean;
}

export interface HousingLegacyReportData {
  runDate: string;
  strategy: string;
  netEquityReleased: number;
  totalLifetimeHousingCosts: number;
  netEstateValue: number;
  endingAssets: number;
  success: boolean;
  firstDepletionYear?: number;
}
