/**
 * aiInsightService — main orchestration service for AI insights.
 *
 * Flow:
 * 1. Validate InsightInput
 * 2. Check cache
 * 3. Build prompt
 * 4. Call AI provider
 * 5. Validate + sanitize response
 * 6. Fallback to deterministic if AI fails
 * 7. Cache result
 * 8. Return InsightOutput
 */

import type { InsightInput, InsightOutput } from './types';
import { validateInsightInput, buildFallbackInsight, sanitizeInsightOutput } from './insightFormatterService';
import { buildPrompt } from './promptBuilderService';
import { callAiProvider, parseAiResponse } from './aiProviderService';
import { getCachedInsight, setCachedInsight } from './aiCacheService';

export interface GenerateInsightResult {
  output: InsightOutput;
  fromCache: boolean;
  fromFallback: boolean;
  error?: string;
}

/**
 * Generate an AI insight for a given structured input.
 * Always returns a result — falls back to deterministic if AI fails.
 */
export async function generateInsight(input: InsightInput): Promise<GenerateInsightResult> {
  // 1. Validate input
  const validation = validateInsightInput(input);
  if (!validation.valid) {
    return {
      output: buildFallbackInsight(input),
      fromCache: false,
      fromFallback: true,
      error: `Invalid input: ${validation.errors.join('; ')}`,
    };
  }

  // 2. Check cache
  const cached = await getCachedInsight(input);
  if (cached) {
    return { output: cached, fromCache: true, fromFallback: false };
  }

  // 3. Build prompt
  const { systemPrompt, userPrompt } = buildPrompt(input);

  // 4. Call AI provider
  let raw: string;
  let provider: 'openai' | 'anthropic';
  try {
    const result = await callAiProvider(systemPrompt, userPrompt);
    raw = result.raw;
    provider = result.provider;
  } catch (err) {
    const fallback = buildFallbackInsight(input);
    return {
      output: fallback,
      fromCache: false,
      fromFallback: true,
      error: `AI provider failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 5. Parse and validate response
  const parsed = parseAiResponse(raw);
  if (!parsed) {
    const fallback = buildFallbackInsight(input);
    return {
      output: fallback,
      fromCache: false,
      fromFallback: true,
      error: 'AI response did not match required schema',
    };
  }

  // 6. Sanitize guardrails
  const sanitized = sanitizeInsightOutput(parsed);

  // 7. Cache result
  await setCachedInsight(input, sanitized, provider);

  return { output: sanitized, fromCache: false, fromFallback: false };
}

/**
 * Build an InsightInput from a tax planning run (helper for API routes).
 */
export function buildInsightInputFromTaxRun(params: {
  householdId: string;
  runId: string;
  scenarioName: string;
  success: boolean;
  firstDepletionYear?: number | null;
  totalFederalTax: number;
  totalStateTax: number;
  totalLifetimeTax: number;
  endingAssets: number;
  projectionStartYear: number;
  projectionEndYear: number;
  filingStatus?: string;
  stateCode?: string;
  rothConversionEnabled?: boolean;
}): InsightInput {
  const yearsFunded = params.success
    ? params.projectionEndYear - params.projectionStartYear
    : (params.firstDepletionYear ?? params.projectionEndYear) - params.projectionStartYear;

  const risks = {
    earlyDepletionRisk: !params.success,
    sequenceRisk: false,
    longevityRisk: false,
    taxInefficiencyRisk: params.totalLifetimeTax > 200000,
    healthcareRisk: false,
    concentrationRisk: yearsFunded < 15,
  };

  return {
    householdId: params.householdId,
    scenarioName: params.scenarioName,
    runId: params.runId,
    insightType: 'TAX_EXPLANATION',
    success: params.success,
    firstDepletionYear: params.firstDepletionYear ?? undefined,
    projectionStartYear: params.projectionStartYear,
    projectionEndYear: params.projectionEndYear,
    endingAssets: params.endingAssets,
    yearsFunded,
    totalTaxes: params.totalLifetimeTax,
    primaryAge: 60, // Placeholder
    risks,
    filingStatus: params.filingStatus,
    stateCode: params.stateCode,
    rothConversionEnabled: params.rothConversionEnabled,
  };
}

/**
 * Build an InsightInput from a healthcare planning run.
 */
export function buildInsightInputFromHealthcareRun(params: {
  householdId: string;
  runId: string;
  scenarioName: string;
  success: boolean;
  firstDepletionYear?: number | null;
  totalHealthcareCost: number;
  endingAssets: number;
  projectionStartYear: number;
  projectionEndYear: number;
  hasLtcStress: boolean;
  hasLongevityStress: boolean;
  longevityTargetAge?: number | null;
}): InsightInput {
  const yearsFunded = params.success
    ? params.projectionEndYear - params.projectionStartYear
    : (params.firstDepletionYear ?? params.projectionEndYear) - params.projectionStartYear;

  const avgAnnualHealthcare = params.totalHealthcareCost / Math.max(1, params.projectionEndYear - params.projectionStartYear);

  const risks = {
    earlyDepletionRisk: !params.success,
    sequenceRisk: false,
    longevityRisk: params.hasLongevityStress && !params.success,
    taxInefficiencyRisk: false,
    healthcareRisk: avgAnnualHealthcare > 8000,
    concentrationRisk: yearsFunded < 15,
  };

  return {
    householdId: params.householdId,
    scenarioName: params.scenarioName,
    runId: params.runId,
    insightType: 'HEALTHCARE_EXPLANATION',
    success: params.success,
    firstDepletionYear: params.firstDepletionYear ?? undefined,
    projectionStartYear: params.projectionStartYear,
    projectionEndYear: params.projectionEndYear,
    endingAssets: params.endingAssets,
    yearsFunded,
    totalHealthcareCost: params.totalHealthcareCost,
    primaryAge: 60,
    risks,
    hasLtcStress: params.hasLtcStress,
    hasLongevityStress: params.hasLongevityStress,
    longevityTargetAge: params.longevityTargetAge ?? undefined,
  };
}

/**
 * Build an InsightInput from a housing planning run.
 */
export function buildInsightInputFromHousingRun(params: {
  householdId: string;
  runId: string;
  scenarioName: string;
  success: boolean;
  firstDepletionYear?: number | null;
  endingAssets: number;
  netEstateValue: number;
  netEquityReleased: number;
  projectionStartYear: number;
  projectionEndYear: number;
  strategy: string;
}): InsightInput {
  const yearsFunded = params.success
    ? params.projectionEndYear - params.projectionStartYear
    : (params.firstDepletionYear ?? params.projectionEndYear) - params.projectionStartYear;

  const risks = {
    earlyDepletionRisk: !params.success,
    sequenceRisk: false,
    longevityRisk: false,
    taxInefficiencyRisk: false,
    healthcareRisk: false,
    concentrationRisk: yearsFunded < 15,
  };

  return {
    householdId: params.householdId,
    scenarioName: params.scenarioName,
    runId: params.runId,
    insightType: 'HOUSING_LEGACY_EXPLANATION',
    success: params.success,
    firstDepletionYear: params.firstDepletionYear ?? undefined,
    projectionStartYear: params.projectionStartYear,
    projectionEndYear: params.projectionEndYear,
    endingAssets: params.endingAssets,
    yearsFunded,
    netEstateValue: params.netEstateValue,
    netEquityReleased: params.netEquityReleased,
    primaryAge: 60,
    risks,
    housingStrategy: params.strategy,
  };
}
