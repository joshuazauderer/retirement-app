/**
 * riskAnalysisService — deterministic risk flag computation from plan outputs.
 *
 * This is pure TypeScript logic — no AI involved.
 * Risk flags are computed from structured simulation outputs and passed to the AI
 * as pre-computed inputs, ensuring risk detection is deterministic and testable.
 */

import type { PlanRiskFlags, RiskAnalysisResult, InsightInput } from './types';

const EARLY_DEPLETION_BUFFER_YEARS = 5;   // Depletion within 5 years of horizon = risk
const HIGH_WITHDRAWAL_RATE = 0.05;         // > 5% = high sequence risk
const HIGH_TAX_BURDEN_THRESHOLD = 0.25;    // > 25% effective tax rate (lifetime) = risk
const HIGH_HEALTHCARE_THRESHOLD = 50000;   // > $50k total healthcare per year avg = risk
const LONGEVITY_BUFFER_YEARS = 10;         // < 10 years buffer beyond horizon = longevity risk

export function computeRiskFlags(params: {
  success: boolean;
  firstDepletionYear?: number;
  projectionEndYear: number;
  projectionStartYear: number;
  endingAssets: number;
  withdrawalRate?: number;
  totalTaxes?: number;
  totalHealthcareCost?: number;
  yearsFunded: number;
  primaryAge: number;
  hasLongevityStress?: boolean;
}): PlanRiskFlags {
  const {
    success,
    firstDepletionYear,
    projectionEndYear,
    projectionStartYear,
    withdrawalRate,
    totalTaxes,
    totalHealthcareCost,
    yearsFunded,
    hasLongevityStress,
  } = params;

  const projectionYears = projectionEndYear - projectionStartYear;

  // Early depletion risk: plan fails or depletes within buffer of horizon
  const earlyDepletionRisk =
    !success ||
    (firstDepletionYear != null &&
      firstDepletionYear <= projectionEndYear - EARLY_DEPLETION_BUFFER_YEARS);

  // Sequence risk: high withdrawal rate in early years
  const sequenceRisk = (withdrawalRate ?? 0) > HIGH_WITHDRAWAL_RATE;

  // Longevity risk: plan does not extend to 95+ or longevity stress applied and still failed
  const longevityRisk =
    (hasLongevityStress === true && !success) ||
    (projectionYears < LONGEVITY_BUFFER_YEARS + 20);

  // Tax inefficiency risk: taxes represent a very high share of projected spending
  // Use a simple heuristic: total taxes > threshold relative to total years
  const avgAnnualTax = totalTaxes != null ? totalTaxes / Math.max(1, projectionYears) : 0;
  const taxInefficiencyRisk = avgAnnualTax > 15000; // > $15k/yr average lifetime tax = flag

  // Healthcare risk: high total or average healthcare costs
  const avgAnnualHealthcare = totalHealthcareCost != null ? totalHealthcareCost / Math.max(1, projectionYears) : 0;
  const healthcareRisk = avgAnnualHealthcare > HIGH_HEALTHCARE_THRESHOLD / projectionYears * 10;

  // Concentration risk: simplified — flag if yearsFunded < 15
  const concentrationRisk = yearsFunded < 15;

  return {
    earlyDepletionRisk,
    sequenceRisk,
    longevityRisk,
    taxInefficiencyRisk,
    healthcareRisk,
    concentrationRisk,
  };
}

export function analyzeRisks(flags: PlanRiskFlags): RiskAnalysisResult {
  const riskCount = Object.values(flags).filter(Boolean).length;

  let riskLevel: RiskAnalysisResult['riskLevel'] = 'LOW';
  if (riskCount >= 4) riskLevel = 'CRITICAL';
  else if (riskCount >= 2) riskLevel = 'HIGH';
  else if (riskCount === 1) riskLevel = 'MEDIUM';

  // Determine primary risk (highest severity first)
  let primaryRisk: string | undefined;
  if (flags.earlyDepletionRisk) primaryRisk = 'Early plan depletion is the primary concern.';
  else if (flags.sequenceRisk) primaryRisk = 'Sequence-of-returns risk is elevated.';
  else if (flags.longevityRisk) primaryRisk = 'Longevity risk: the plan horizon may be insufficient.';
  else if (flags.healthcareRisk) primaryRisk = 'Healthcare cost burden is significant.';
  else if (flags.taxInefficiencyRisk) primaryRisk = 'Tax burden over the retirement horizon is high.';
  else if (flags.concentrationRisk) primaryRisk = 'Plan duration may be shorter than typical retirement needs.';

  return { flags, riskLevel, riskCount, primaryRisk };
}

/**
 * Build risk flags from an InsightInput (for when caller has a full InsightInput).
 */
export function buildRiskFlagsFromInsightInput(input: InsightInput): PlanRiskFlags {
  return computeRiskFlags({
    success: input.success,
    firstDepletionYear: input.firstDepletionYear,
    projectionEndYear: input.projectionEndYear,
    projectionStartYear: input.projectionStartYear,
    endingAssets: input.endingAssets,
    withdrawalRate: input.withdrawalRate,
    totalTaxes: input.totalTaxes,
    totalHealthcareCost: input.totalHealthcareCost,
    yearsFunded: input.yearsFunded,
    primaryAge: input.primaryAge,
    hasLongevityStress: input.hasLongevityStress,
  });
}
