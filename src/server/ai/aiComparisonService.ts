/**
 * aiComparisonService — builds comparison InsightInput from two run summaries.
 */

import type { InsightInput } from './types';

export interface ComparisonRunSummary {
  runId: string;
  scenarioName: string;
  success: boolean;
  firstDepletionYear?: number | null;
  endingAssets: number;
  projectionStartYear: number;
  projectionEndYear: number;
  totalTaxes?: number;
  totalHealthcareCost?: number;
  netEstateValue?: number;
}

export function buildComparisonInsightInput(
  householdId: string,
  runA: ComparisonRunSummary,
  runB: ComparisonRunSummary,
): InsightInput {
  const yearsFundedB = runB.success
    ? runB.projectionEndYear - runB.projectionStartYear
    : (runB.firstDepletionYear ?? runB.projectionEndYear) - runB.projectionStartYear;

  const endingAssetsDelta = runB.endingAssets - runA.endingAssets;
  const firstDepletionYearDelta =
    runA.firstDepletionYear != null && runB.firstDepletionYear != null
      ? runB.firstDepletionYear - runA.firstDepletionYear
      : undefined;
  const totalTaxDelta =
    runA.totalTaxes != null && runB.totalTaxes != null
      ? runA.totalTaxes - runB.totalTaxes  // Positive = B has lower taxes (better)
      : undefined;
  const totalHealthcareDelta =
    runA.totalHealthcareCost != null && runB.totalHealthcareCost != null
      ? runA.totalHealthcareCost - runB.totalHealthcareCost
      : undefined;
  const netEstateValueDelta =
    runA.netEstateValue != null && runB.netEstateValue != null
      ? runB.netEstateValue - runA.netEstateValue
      : undefined;

  const risks = {
    earlyDepletionRisk: !runB.success,
    sequenceRisk: false,
    longevityRisk: false,
    taxInefficiencyRisk: false,
    healthcareRisk: false,
    concentrationRisk: yearsFundedB < 15,
  };

  return {
    householdId,
    scenarioName: `${runB.scenarioName} vs ${runA.scenarioName}`,
    runId: runB.runId,
    insightType: 'SCENARIO_COMPARISON',
    success: runB.success,
    firstDepletionYear: runB.firstDepletionYear ?? undefined,
    projectionStartYear: runB.projectionStartYear,
    projectionEndYear: runB.projectionEndYear,
    endingAssets: runB.endingAssets,
    yearsFunded: yearsFundedB,
    totalTaxes: runB.totalTaxes,
    totalHealthcareCost: runB.totalHealthcareCost,
    netEstateValue: runB.netEstateValue,
    primaryAge: 60,
    risks,
    deltas: {
      endingAssetsDelta,
      firstDepletionYearDelta,
      totalTaxDelta,
      totalHealthcareDelta,
      netEstateValueDelta,
    },
  };
}
