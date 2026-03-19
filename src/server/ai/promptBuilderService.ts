/**
 * promptBuilderService — centralized, versioned prompt construction.
 *
 * ALL prompts live here. No prompt logic in UI code.
 * Prompts are deterministic, versioned, and schema-enforced.
 *
 * GUARDRAILS baked into every prompt:
 * - Never say "you should" or "you must"
 * - Use hedged, non-authoritative language
 * - Include uncertainty framing
 * - Explicitly forbid invented numbers
 */

import { AI_PROMPT_VERSION } from './types';
import type { InsightInput, InsightType } from './types';
import { selectRecommendations, formatRecommendationsForPrompt } from './recommendationService';
import { analyzeRisks } from './riskAnalysisService';

// System prompt shared across all insight types
const BASE_SYSTEM_PROMPT = `You are a retirement planning insight assistant embedded in a financial planning application.

Your role:
- Explain retirement plan results in plain, clear language
- Identify risks based on provided data
- Suggest possible adjustments in bounded, non-authoritative terms
- Help users understand tradeoffs

MANDATORY RULES:
- NEVER say "you should", "you must", "you need to", or "I recommend you"
- ALWAYS use language like "one option to consider is...", "this plan may benefit from...", "it may be worth exploring..."
- NEVER invent numbers. Only use numbers provided in the input data.
- NEVER give definitive financial, legal, or medical advice
- ALWAYS include uncertainty framing ("depending on circumstances", "results will vary", "consult a financial professional for personalized advice")
- ALWAYS ground your response in the provided data

OUTPUT FORMAT:
You must respond with valid JSON matching this exact schema:
{
  "summary": "string (2-4 sentences, plain language plan overview)",
  "keyInsights": ["string", "string", "string"] (3-5 bullet insights grounded in the data),
  "risks": ["string", "string"] (identified risk factors from the flags provided),
  "recommendations": ["string", "string"] (bounded, non-authoritative suggestions),
  "confidenceNotes": ["string"] (1-3 uncertainty framing statements)
}

Do not include any text outside the JSON object.`;

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Build prompt for PLAN_SUMMARY insight type.
 */
function buildPlanSummaryPrompt(input: InsightInput): string {
  const recs = selectRecommendations(input.risks);
  const recText = formatRecommendationsForPrompt(recs);
  const riskAnalysis = analyzeRisks(input.risks);

  return `Generate a retirement plan summary insight for the following plan data.

PLAN DATA:
- Scenario: ${input.scenarioName}
- Plan Status: ${input.success ? 'FULLY FUNDED (no depletion in projection period)' : `DEPLETED in ${input.firstDepletionYear ?? 'unknown year'}`}
- Projection Period: ${input.projectionStartYear} to ${input.projectionEndYear} (${input.yearsFunded} years funded)
- Ending Assets: ${fmt(input.endingAssets)}
${input.withdrawalRate != null ? `- Withdrawal Rate: ${fmtPct(input.withdrawalRate)}` : ''}
${input.totalTaxes != null ? `- Lifetime Tax Burden: ${fmt(input.totalTaxes)}` : ''}
${input.totalHealthcareCost != null ? `- Lifetime Healthcare Costs: ${fmt(input.totalHealthcareCost)}` : ''}
${input.netEstateValue != null ? `- Projected Net Estate Value: ${fmt(input.netEstateValue)}` : ''}
${input.housingStrategy ? `- Housing Strategy: ${input.housingStrategy.replace(/_/g, ' ')}` : ''}
${input.netEquityReleased != null && input.netEquityReleased > 0 ? `- Net Equity Released: ${fmt(input.netEquityReleased)}` : ''}

RISK ASSESSMENT:
- Overall Risk Level: ${riskAnalysis.riskLevel}
- Active Risks: ${riskAnalysis.riskCount} risk(s) identified
${riskAnalysis.primaryRisk ? `- Primary Concern: ${riskAnalysis.primaryRisk}` : ''}
- Early Depletion Risk: ${input.risks.earlyDepletionRisk ? 'YES' : 'No'}
- Sequence Risk: ${input.risks.sequenceRisk ? 'YES' : 'No'}
- Longevity Risk: ${input.risks.longevityRisk ? 'YES' : 'No'}
- Tax Inefficiency Risk: ${input.risks.taxInefficiencyRisk ? 'YES' : 'No'}
- Healthcare Risk: ${input.risks.healthcareRisk ? 'YES' : 'No'}

APPLICABLE ADJUSTMENTS TO MENTION:
${recText}

Now generate a structured insight response in the required JSON format. Ground everything in the numbers provided. Do not invent figures.`;
}

/**
 * Build prompt for SCENARIO_COMPARISON insight type.
 */
function buildComparisonPrompt(input: InsightInput): string {
  const deltas = input.deltas ?? {};
  return `Generate a scenario comparison insight for the following comparison data.

SCENARIO: ${input.scenarioName}
PLAN STATUS: ${input.success ? 'Fully Funded' : `Depleted in ${input.firstDepletionYear ?? 'unknown'}`}
ENDING ASSETS: ${fmt(input.endingAssets)}

COMPARISON DELTAS (positive = better for this scenario vs baseline):
${deltas.endingAssetsDelta != null ? `- Ending Assets Change: ${fmt(deltas.endingAssetsDelta)} (${deltas.endingAssetsDelta >= 0 ? 'higher' : 'lower'} than baseline)` : ''}
${deltas.firstDepletionYearDelta != null ? `- Depletion Year Change: ${deltas.firstDepletionYearDelta > 0 ? `${deltas.firstDepletionYearDelta} years later` : `${Math.abs(deltas.firstDepletionYearDelta)} years earlier`}` : ''}
${deltas.totalTaxDelta != null ? `- Tax Change: ${fmt(Math.abs(deltas.totalTaxDelta))} ${deltas.totalTaxDelta < 0 ? 'lower' : 'higher'} taxes` : ''}
${deltas.totalHealthcareDelta != null ? `- Healthcare Cost Change: ${fmt(Math.abs(deltas.totalHealthcareDelta))} ${deltas.totalHealthcareDelta < 0 ? 'lower' : 'higher'}` : ''}
${deltas.netEstateValueDelta != null ? `- Legacy/Estate Change: ${fmt(deltas.netEstateValueDelta)} ${deltas.netEstateValueDelta >= 0 ? 'higher' : 'lower'} estate value` : ''}

RISK FLAGS:
- Early Depletion Risk: ${input.risks.earlyDepletionRisk ? 'YES' : 'No'}
- Sequence Risk: ${input.risks.sequenceRisk ? 'YES' : 'No'}
- Longevity Risk: ${input.risks.longevityRisk ? 'YES' : 'No'}

Generate a comparison insight explaining what changed, what improved, what worsened, and the key tradeoffs. Use non-authoritative language. Return valid JSON only.`;
}

/**
 * Build prompt for RISK_DETECTION insight type.
 */
function buildRiskDetectionPrompt(input: InsightInput): string {
  const riskAnalysis = analyzeRisks(input.risks);
  return `Generate a risk-focused insight for the following retirement plan.

PLAN STATUS: ${input.success ? 'Fully Funded' : `At Risk — Depletion projected in ${input.firstDepletionYear ?? 'unknown'}`}
RISK LEVEL: ${riskAnalysis.riskLevel} (${riskAnalysis.riskCount} risk factors identified)

RISK FLAGS:
- Early Depletion Risk: ${input.risks.earlyDepletionRisk}
- Sequence-of-Returns Risk: ${input.risks.sequenceRisk}
- Longevity Risk: ${input.risks.longevityRisk}
- Tax Inefficiency Risk: ${input.risks.taxInefficiencyRisk}
- Healthcare Cost Risk: ${input.risks.healthcareRisk}
- Plan Duration Risk: ${input.risks.concentrationRisk}

KEY METRICS:
- Ending Assets: ${fmt(input.endingAssets)}
- Years Funded: ${input.yearsFunded}
${input.withdrawalRate != null ? `- Withdrawal Rate: ${fmtPct(input.withdrawalRate)}` : ''}

Generate a risk detection insight. Focus on helping the user understand the nature of each risk and its potential impact. Use plain language. Return valid JSON only.`;
}

/**
 * Build prompt for TAX_EXPLANATION insight type.
 */
function buildTaxExplanationPrompt(input: InsightInput): string {
  return `Generate a tax planning insight for the following retirement plan.

TAX SUMMARY:
${input.totalTaxes != null ? `- Lifetime Tax Burden: ${fmt(input.totalTaxes)}` : ''}
${input.filingStatus ? `- Filing Status: ${input.filingStatus}` : ''}
${input.stateCode ? `- State: ${input.stateCode}` : ''}
${input.rothConversionEnabled ? '- Roth Conversion: Included in this analysis' : '- Roth Conversion: Not modeled in this run'}
- Tax Inefficiency Risk: ${input.risks.taxInefficiencyRisk ? 'YES — tax burden is elevated' : 'No significant concern identified'}

PLAN CONTEXT:
- Projection Period: ${input.projectionStartYear}–${input.projectionEndYear}
- Ending Assets: ${fmt(input.endingAssets)}
${input.firstDepletionYear ? `- First Depletion Year: ${input.firstDepletionYear}` : '- Plan Status: Fully Funded'}

Generate a tax planning insight explaining the tax profile, what this means for the retirement plan, and any tax-related options worth considering. Use non-authoritative, hedged language. Return valid JSON only.`;
}

/**
 * Build prompt for HEALTHCARE_EXPLANATION insight type.
 */
function buildHealthcareExplanationPrompt(input: InsightInput): string {
  return `Generate a healthcare cost insight for the following retirement plan.

HEALTHCARE SUMMARY:
${input.totalHealthcareCost != null ? `- Lifetime Healthcare Cost: ${fmt(input.totalHealthcareCost)}` : ''}
- LTC Stress Applied: ${input.hasLtcStress ? 'YES' : 'No'}
- Longevity Stress Applied: ${input.hasLongevityStress ? `YES — projected to age ${input.longevityTargetAge ?? 'extended'}` : 'No'}
- Healthcare Cost Risk: ${input.risks.healthcareRisk ? 'YES — costs are elevated' : 'Within expected range'}

PLAN CONTEXT:
- Ending Assets: ${fmt(input.endingAssets)}
- Plan Status: ${input.success ? 'Fully Funded' : `Depleted ${input.firstDepletionYear ?? ''}`}

Generate a healthcare planning insight explaining cost patterns, Medicare transition implications, and what the healthcare burden means for plan durability. Use non-authoritative language. Return valid JSON only.`;
}

/**
 * Build prompt for HOUSING_LEGACY_EXPLANATION insight type.
 */
function buildHousingLegacyPrompt(input: InsightInput): string {
  return `Generate a housing and legacy planning insight for the following retirement plan.

HOUSING SUMMARY:
${input.housingStrategy ? `- Strategy: ${input.housingStrategy.replace(/_/g, ' ')}` : ''}
${input.netEquityReleased != null ? `- Net Equity Released: ${fmt(input.netEquityReleased)}` : ''}
${input.netEstateValue != null ? `- Projected Net Estate/Legacy Value: ${fmt(input.netEstateValue)}` : ''}

PLAN CONTEXT:
- Ending Assets: ${fmt(input.endingAssets)}
- Plan Status: ${input.success ? 'Fully Funded' : `Depleted ${input.firstDepletionYear ?? ''}`}

Generate a housing and legacy insight explaining how the housing choice affects retirement durability and what the projected legacy value means. Use non-authoritative, hedged language. Return valid JSON only.`;
}

/**
 * Main prompt builder — routes to correct builder by insight type.
 */
export function buildPrompt(input: InsightInput): {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
} {
  let userPrompt: string;
  switch (input.insightType) {
    case 'PLAN_SUMMARY':
    case 'RECOMMENDATION':
      userPrompt = buildPlanSummaryPrompt(input);
      break;
    case 'RISK_DETECTION':
      userPrompt = buildRiskDetectionPrompt(input);
      break;
    case 'SCENARIO_COMPARISON':
      userPrompt = buildComparisonPrompt(input);
      break;
    case 'TAX_EXPLANATION':
      userPrompt = buildTaxExplanationPrompt(input);
      break;
    case 'HEALTHCARE_EXPLANATION':
      userPrompt = buildHealthcareExplanationPrompt(input);
      break;
    case 'HOUSING_LEGACY_EXPLANATION':
      userPrompt = buildHousingLegacyPrompt(input);
      break;
    default:
      userPrompt = buildPlanSummaryPrompt(input);
  }

  return {
    systemPrompt: BASE_SYSTEM_PROMPT,
    userPrompt,
    promptVersion: AI_PROMPT_VERSION,
  };
}
