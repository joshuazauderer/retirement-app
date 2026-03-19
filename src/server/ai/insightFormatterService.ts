/**
 * insightFormatterService — schema validation and output formatting for AI responses.
 *
 * Enforces the InsightOutput schema.
 * Applies guardrail checks on AI output.
 * Provides fallback deterministic explanation when AI fails.
 */

import type { InsightOutput, InsightInput, InsightValidation } from './types';
import { GUARDRAIL_FORBIDDEN_PHRASES } from './types';
import { analyzeRisks } from './riskAnalysisService';

/**
 * Validate that an AI response matches the required InsightOutput schema.
 */
export function validateInsightOutput(obj: unknown): InsightValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, errors: ['Response is not an object'], warnings };
  }

  const o = obj as Record<string, unknown>;

  if (typeof o.summary !== 'string' || o.summary.length < 10) {
    errors.push('summary must be a non-empty string');
  }
  if (!Array.isArray(o.keyInsights) || o.keyInsights.length < 1) {
    errors.push('keyInsights must be a non-empty array');
  }
  if (!Array.isArray(o.risks)) {
    errors.push('risks must be an array');
  }
  if (!Array.isArray(o.recommendations)) {
    errors.push('recommendations must be an array');
  }
  if (!Array.isArray(o.confidenceNotes)) {
    errors.push('confidenceNotes must be an array');
  }

  // Guardrail check for forbidden phrases
  if (errors.length === 0) {
    const allText = [
      o.summary,
      ...(o.keyInsights as string[]),
      ...(o.risks as string[]),
      ...(o.recommendations as string[]),
      ...(o.confidenceNotes as string[]),
    ].join(' ').toLowerCase();

    for (const phrase of GUARDRAIL_FORBIDDEN_PHRASES) {
      if (allText.includes(phrase.toLowerCase())) {
        warnings.push(`Guardrail warning: response contains forbidden phrase "${phrase}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate the input before sending to AI.
 */
export function validateInsightInput(input: InsightInput): InsightValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.householdId) errors.push('householdId is required');
  if (!input.scenarioName) errors.push('scenarioName is required');
  if (!input.runId) errors.push('runId is required');
  if (typeof input.success !== 'boolean') errors.push('success must be a boolean');
  if (typeof input.endingAssets !== 'number') errors.push('endingAssets must be a number');
  if (typeof input.yearsFunded !== 'number') errors.push('yearsFunded must be a number');
  if (!input.risks) errors.push('risks object is required');

  if (input.insightType === 'SCENARIO_COMPARISON' && !input.deltas) {
    warnings.push('SCENARIO_COMPARISON insight type without deltas — comparison will be limited');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Deterministic fallback explanation when AI is unavailable.
 * This ensures the UI is never blocked.
 */
export function buildFallbackInsight(input: InsightInput): InsightOutput {
  const riskAnalysis = analyzeRisks(input.risks);
  const statusText = input.success
    ? `The plan appears fully funded through ${input.projectionEndYear}, with ending assets of $${Math.round(input.endingAssets).toLocaleString()}.`
    : `The plan shows a depletion risk, with assets potentially exhausted around ${input.firstDepletionYear ?? 'an earlier-than-expected year'}.`;

  const risks: string[] = [];
  if (input.risks.earlyDepletionRisk) risks.push('Early depletion risk identified — the portfolio may not last the full projection period.');
  if (input.risks.sequenceRisk) risks.push('Sequence-of-returns risk is elevated due to the withdrawal rate.');
  if (input.risks.longevityRisk) risks.push('Longevity risk — the projection horizon may not be sufficient.');
  if (input.risks.taxInefficiencyRisk) risks.push('Tax burden over the projection period is significant.');
  if (input.risks.healthcareRisk) risks.push('Healthcare cost burden is elevated.');

  return {
    summary: `${statusText} ${riskAnalysis.riskCount} risk factor(s) identified. This is a planning-grade estimate; consult a financial professional for personalized guidance.`,
    keyInsights: [
      `Projection period: ${input.projectionStartYear}–${input.projectionEndYear} (${input.yearsFunded} years funded)`,
      `Ending assets: $${Math.round(input.endingAssets).toLocaleString()}`,
      input.totalTaxes != null ? `Lifetime taxes: $${Math.round(input.totalTaxes).toLocaleString()}` : 'Tax data not available for this run',
      input.totalHealthcareCost != null ? `Lifetime healthcare: $${Math.round(input.totalHealthcareCost).toLocaleString()}` : 'Healthcare data not available for this run',
    ].filter(Boolean) as string[],
    risks: risks.length > 0 ? risks : ['No significant risk flags identified in this run.'],
    recommendations: [
      'Review the year-by-year projections for more detail on how the plan evolves over time.',
      'Consider running additional scenario comparisons to test plan sensitivity.',
    ],
    confidenceNotes: [
      'This is a planning-grade estimate based on stated assumptions. Actual outcomes will differ.',
      'AI insight generation was unavailable — this is a deterministic fallback summary.',
      'Consult a qualified financial professional for personalized retirement advice.',
    ],
  };
}

/**
 * Sanitize AI output to ensure it does not contain forbidden phrases.
 * Replaces them with hedged alternatives.
 */
export function sanitizeInsightOutput(output: InsightOutput): InsightOutput {
  const replacements: [string, string][] = [
    ['you should', 'one option to consider is'],
    ['you must', 'it may be important to'],
    ['you need to', 'it may be worth exploring'],
    ['I recommend you', 'one approach to consider is'],
    ['guaranteed', 'projected'],
    ['will definitely', 'may'],
    ['certain to', 'likely to'],
  ];

  function sanitizeText(text: string): string {
    let result = text;
    for (const [forbidden, replacement] of replacements) {
      result = result.replace(new RegExp(forbidden, 'gi'), replacement);
    }
    return result;
  }

  function sanitizeArray(arr: string[]): string[] {
    return arr.map(sanitizeText);
  }

  return {
    summary: sanitizeText(output.summary),
    keyInsights: sanitizeArray(output.keyInsights),
    risks: sanitizeArray(output.risks),
    recommendations: sanitizeArray(output.recommendations),
    confidenceNotes: sanitizeArray(output.confidenceNotes),
  };
}
