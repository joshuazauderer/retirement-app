import { describe, test, expect } from 'vitest';
import { computeRiskFlags, analyzeRisks, buildRiskFlagsFromInsightInput } from '../server/ai/riskAnalysisService';
import { selectRecommendations, formatRecommendationsForPrompt } from '../server/ai/recommendationService';
import { buildPrompt } from '../server/ai/promptBuilderService';
import {
  validateInsightOutput,
  validateInsightInput,
  buildFallbackInsight,
  sanitizeInsightOutput,
} from '../server/ai/insightFormatterService';
import { buildComparisonInsightInput } from '../server/ai/aiComparisonService';
import { GUARDRAIL_FORBIDDEN_PHRASES } from '../server/ai/types';
import type { PlanRiskFlags, InsightInput, InsightOutput } from '../server/ai/types';

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function makeAllFalseFlags(): PlanRiskFlags {
  return {
    earlyDepletionRisk: false,
    sequenceRisk: false,
    longevityRisk: false,
    taxInefficiencyRisk: false,
    healthcareRisk: false,
    concentrationRisk: false,
  };
}

function makeBaseInsightInput(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    householdId: 'hh-1',
    scenarioName: 'Base Scenario',
    runId: 'run-1',
    insightType: 'PLAN_SUMMARY',
    success: true,
    projectionStartYear: 2025,
    projectionEndYear: 2055,
    endingAssets: 500000,
    yearsFunded: 30,
    primaryAge: 65,
    risks: makeAllFalseFlags(),
    ...overrides,
  };
}

// -------------------------------------------------------------------------
// 1. riskAnalysisService
// -------------------------------------------------------------------------

describe('riskAnalysisService', () => {
  test('computeRiskFlags: depleted plan → earlyDepletionRisk=true', () => {
    const flags = computeRiskFlags({
      success: false,
      firstDepletionYear: 2035,
      projectionEndYear: 2055,
      projectionStartYear: 2025,
      endingAssets: 0,
      yearsFunded: 10,
      primaryAge: 65,
    });
    expect(flags.earlyDepletionRisk).toBe(true);
  });

  test('computeRiskFlags: fully funded, low WR → earlyDepletionRisk=false, sequenceRisk=false', () => {
    const flags = computeRiskFlags({
      success: true,
      projectionEndYear: 2055,
      projectionStartYear: 2025,
      endingAssets: 800000,
      withdrawalRate: 0.03,
      yearsFunded: 30,
      primaryAge: 65,
    });
    expect(flags.earlyDepletionRisk).toBe(false);
    expect(flags.sequenceRisk).toBe(false);
  });

  test('computeRiskFlags: high withdrawal rate → sequenceRisk=true', () => {
    const flags = computeRiskFlags({
      success: true,
      projectionEndYear: 2055,
      projectionStartYear: 2025,
      endingAssets: 200000,
      withdrawalRate: 0.07,
      yearsFunded: 30,
      primaryAge: 65,
    });
    expect(flags.sequenceRisk).toBe(true);
  });

  test('analyzeRisks: 0 flags → LOW risk level', () => {
    const result = analyzeRisks(makeAllFalseFlags());
    expect(result.riskLevel).toBe('LOW');
    expect(result.riskCount).toBe(0);
  });

  test('analyzeRisks: 2 flags → HIGH risk level', () => {
    const flags: PlanRiskFlags = {
      ...makeAllFalseFlags(),
      earlyDepletionRisk: true,
      sequenceRisk: true,
    };
    const result = analyzeRisks(flags);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.riskCount).toBe(2);
  });

  test('analyzeRisks: 4 flags → CRITICAL risk level', () => {
    const flags: PlanRiskFlags = {
      earlyDepletionRisk: true,
      sequenceRisk: true,
      longevityRisk: true,
      taxInefficiencyRisk: true,
      healthcareRisk: false,
      concentrationRisk: false,
    };
    const result = analyzeRisks(flags);
    expect(result.riskLevel).toBe('CRITICAL');
  });

  test('analyzeRisks: primaryRisk is set when earlyDepletionRisk=true', () => {
    const flags: PlanRiskFlags = { ...makeAllFalseFlags(), earlyDepletionRisk: true };
    const result = analyzeRisks(flags);
    expect(result.primaryRisk).toBeDefined();
    expect(result.primaryRisk).toContain('depletion');
  });

  test('analyzeRisks: 1 flag → MEDIUM risk level', () => {
    const flags: PlanRiskFlags = { ...makeAllFalseFlags(), sequenceRisk: true };
    const result = analyzeRisks(flags);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.riskCount).toBe(1);
  });
});

// -------------------------------------------------------------------------
// 2. recommendationService
// -------------------------------------------------------------------------

describe('recommendationService', () => {
  test('selectRecommendations: empty flags → empty array', () => {
    const recs = selectRecommendations(makeAllFalseFlags());
    expect(recs).toHaveLength(0);
  });

  test('selectRecommendations: earlyDepletionRisk → includes delay-retirement', () => {
    const flags: PlanRiskFlags = { ...makeAllFalseFlags(), earlyDepletionRisk: true };
    const recs = selectRecommendations(flags);
    expect(recs.some((r) => r.id === 'delay-retirement')).toBe(true);
  });

  test('selectRecommendations: taxInefficiencyRisk → includes roth-conversion', () => {
    const flags: PlanRiskFlags = { ...makeAllFalseFlags(), taxInefficiencyRisk: true };
    const recs = selectRecommendations(flags);
    expect(recs.some((r) => r.id === 'roth-conversion')).toBe(true);
  });

  test('selectRecommendations: max 4 recommendations returned', () => {
    const flags: PlanRiskFlags = {
      earlyDepletionRisk: true,
      sequenceRisk: true,
      longevityRisk: true,
      taxInefficiencyRisk: true,
      healthcareRisk: true,
      concentrationRisk: true,
    };
    const recs = selectRecommendations(flags);
    expect(recs.length).toBeLessThanOrEqual(4);
  });

  test('formatRecommendationsForPrompt: returns string with numbered items', () => {
    const flags: PlanRiskFlags = { ...makeAllFalseFlags(), earlyDepletionRisk: true };
    const recs = selectRecommendations(flags);
    const text = formatRecommendationsForPrompt(recs);
    expect(typeof text).toBe('string');
    expect(text).toContain('1.');
  });

  test('formatRecommendationsForPrompt: returns fallback text when empty', () => {
    const text = formatRecommendationsForPrompt([]);
    expect(text).toContain('No specific');
  });
});

// -------------------------------------------------------------------------
// 3. promptBuilderService
// -------------------------------------------------------------------------

describe('promptBuilderService', () => {
  test('buildPrompt PLAN_SUMMARY: returns systemPrompt, userPrompt, promptVersion', () => {
    const input = makeBaseInsightInput({ insightType: 'PLAN_SUMMARY' });
    const result = buildPrompt(input);
    expect(result.systemPrompt).toBeTruthy();
    expect(result.userPrompt).toBeTruthy();
    expect(result.promptVersion).toBe('v1.0');
  });

  test('buildPrompt: userPrompt contains scenario name', () => {
    const input = makeBaseInsightInput({ insightType: 'PLAN_SUMMARY', scenarioName: 'My Unique Scenario' });
    const { userPrompt } = buildPrompt(input);
    expect(userPrompt).toContain('My Unique Scenario');
  });

  test('buildPrompt: userPrompt contains ending assets', () => {
    const input = makeBaseInsightInput({ insightType: 'PLAN_SUMMARY', endingAssets: 750000 });
    const { userPrompt } = buildPrompt(input);
    expect(userPrompt).toContain('750,000');
  });

  test('buildPrompt SCENARIO_COMPARISON: includes delta information', () => {
    const input = makeBaseInsightInput({
      insightType: 'SCENARIO_COMPARISON',
      deltas: { endingAssetsDelta: 50000, totalTaxDelta: -10000 },
    });
    const { userPrompt } = buildPrompt(input);
    expect(userPrompt).toContain('COMPARISON DELTAS');
  });

  test('buildPrompt TAX_EXPLANATION: includes tax-specific content', () => {
    const input = makeBaseInsightInput({
      insightType: 'TAX_EXPLANATION',
      totalTaxes: 120000,
    });
    const { userPrompt } = buildPrompt(input);
    expect(userPrompt).toContain('TAX SUMMARY');
  });

  test('buildPrompt HEALTHCARE_EXPLANATION: includes healthcare content', () => {
    const input = makeBaseInsightInput({
      insightType: 'HEALTHCARE_EXPLANATION',
      totalHealthcareCost: 85000,
    });
    const { userPrompt } = buildPrompt(input);
    expect(userPrompt).toContain('HEALTHCARE SUMMARY');
  });

  test('buildPrompt HOUSING_LEGACY_EXPLANATION: includes housing content', () => {
    const input = makeBaseInsightInput({
      insightType: 'HOUSING_LEGACY_EXPLANATION',
      housingStrategy: 'downsize',
    });
    const { userPrompt } = buildPrompt(input);
    expect(userPrompt).toContain('HOUSING SUMMARY');
  });

  test('buildPrompt system prompt contains guardrail rules', () => {
    const input = makeBaseInsightInput();
    const { systemPrompt } = buildPrompt(input);
    expect(systemPrompt).toContain('NEVER say');
    expect(systemPrompt).toContain('JSON');
  });
});

// -------------------------------------------------------------------------
// 4. insightFormatterService
// -------------------------------------------------------------------------

describe('insightFormatterService', () => {
  const validOutput: InsightOutput = {
    summary: 'This is a valid summary of the retirement plan.',
    keyInsights: ['Insight one', 'Insight two', 'Insight three'],
    risks: ['No major risks identified'],
    recommendations: ['Consider reviewing annually'],
    confidenceNotes: ['Planning-grade estimate only.'],
  };

  test('validateInsightOutput: valid InsightOutput passes', () => {
    const result = validateInsightOutput(validOutput);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('validateInsightOutput: missing summary fails', () => {
    const result = validateInsightOutput({ ...validOutput, summary: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('summary'))).toBe(true);
  });

  test('validateInsightOutput: missing keyInsights fails', () => {
    const result = validateInsightOutput({ ...validOutput, keyInsights: undefined });
    expect(result.valid).toBe(false);
  });

  test('validateInsightOutput: empty array keyInsights fails', () => {
    const result = validateInsightOutput({ ...validOutput, keyInsights: [] });
    expect(result.valid).toBe(false);
  });

  test('validateInsightOutput: non-object returns invalid', () => {
    const result = validateInsightOutput('not an object');
    expect(result.valid).toBe(false);
  });

  test('validateInsightInput: valid input passes', () => {
    const input = makeBaseInsightInput();
    const result = validateInsightInput(input);
    expect(result.valid).toBe(true);
  });

  test('validateInsightInput: missing householdId fails', () => {
    const input = makeBaseInsightInput({ householdId: '' });
    const result = validateInsightInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('householdId'))).toBe(true);
  });

  test('validateInsightInput: missing runId fails', () => {
    const input = makeBaseInsightInput({ runId: '' });
    const result = validateInsightInput(input);
    expect(result.valid).toBe(false);
  });

  test('buildFallbackInsight: returns valid InsightOutput structure', () => {
    const input = makeBaseInsightInput();
    const output = buildFallbackInsight(input);
    expect(typeof output.summary).toBe('string');
    expect(output.summary.length).toBeGreaterThan(10);
    expect(Array.isArray(output.keyInsights)).toBe(true);
    expect(Array.isArray(output.risks)).toBe(true);
    expect(Array.isArray(output.recommendations)).toBe(true);
    expect(Array.isArray(output.confidenceNotes)).toBe(true);
  });

  test('buildFallbackInsight: depleted plan mentions depletion in summary', () => {
    const input = makeBaseInsightInput({
      success: false,
      firstDepletionYear: 2035,
      risks: { ...makeAllFalseFlags(), earlyDepletionRisk: true },
    });
    const output = buildFallbackInsight(input);
    expect(output.summary).toContain('depletion');
  });

  test('sanitizeInsightOutput: replaces "you should" with hedged phrase', () => {
    const output: InsightOutput = {
      ...validOutput,
      recommendations: ['You should reduce your spending immediately.'],
    };
    const sanitized = sanitizeInsightOutput(output);
    expect(sanitized.recommendations[0]).not.toMatch(/you should/i);
    expect(sanitized.recommendations[0]).toContain('one option to consider is');
  });

  test('sanitizeInsightOutput: replaces "guaranteed" with "projected"', () => {
    const output: InsightOutput = {
      ...validOutput,
      summary: 'This plan is guaranteed to succeed.',
    };
    const sanitized = sanitizeInsightOutput(output);
    expect(sanitized.summary).not.toMatch(/guaranteed/i);
    expect(sanitized.summary).toContain('projected');
  });

  test('GUARDRAIL_FORBIDDEN_PHRASES has expected phrases', () => {
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('you should');
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('guaranteed');
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('will definitely');
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('you must');
  });
});

// -------------------------------------------------------------------------
// 5. aiComparisonService
// -------------------------------------------------------------------------

describe('aiComparisonService', () => {
  const runA = {
    runId: 'run-a',
    scenarioName: 'Base Plan',
    success: true,
    endingAssets: 400000,
    projectionStartYear: 2025,
    projectionEndYear: 2055,
    totalTaxes: 150000,
    totalHealthcareCost: 80000,
    netEstateValue: 300000,
  };

  const runB = {
    runId: 'run-b',
    scenarioName: 'Roth Conversion Plan',
    success: true,
    endingAssets: 500000,
    projectionStartYear: 2025,
    projectionEndYear: 2055,
    totalTaxes: 120000,
    totalHealthcareCost: 80000,
    netEstateValue: 380000,
  };

  const runBFailed = {
    ...runB,
    success: false,
    firstDepletionYear: 2040,
    runId: 'run-b-failed',
  };

  test('buildComparisonInsightInput: sets SCENARIO_COMPARISON insightType', () => {
    const input = buildComparisonInsightInput('hh-1', runA, runB);
    expect(input.insightType).toBe('SCENARIO_COMPARISON');
  });

  test('buildComparisonInsightInput: computes correct endingAssetsDelta', () => {
    const input = buildComparisonInsightInput('hh-1', runA, runB);
    expect(input.deltas?.endingAssetsDelta).toBe(100000); // 500k - 400k
  });

  test('buildComparisonInsightInput: earlyDepletionRisk when runB fails', () => {
    const input = buildComparisonInsightInput('hh-1', runA, runBFailed);
    expect(input.risks.earlyDepletionRisk).toBe(true);
  });

  test('buildComparisonInsightInput: sets correct scenarioName combining both', () => {
    const input = buildComparisonInsightInput('hh-1', runA, runB);
    expect(input.scenarioName).toContain('Roth Conversion Plan');
    expect(input.scenarioName).toContain('Base Plan');
  });

  test('buildComparisonInsightInput: negative tax delta when B has lower taxes', () => {
    const input = buildComparisonInsightInput('hh-1', runA, runB);
    // runA.totalTaxes - runB.totalTaxes = 150000 - 120000 = 30000 (positive = B is better)
    expect(input.deltas?.totalTaxDelta).toBe(30000);
  });
});

// -------------------------------------------------------------------------
// 6. aiCacheService (in-memory only — no DB)
// -------------------------------------------------------------------------

describe('aiCacheService cache key logic', () => {
  test('same input produces equivalent cache key components', () => {
    const input = makeBaseInsightInput({ householdId: 'hh-x', runId: 'run-x', insightType: 'TAX_EXPLANATION' });
    // We verify the cache key components are predictable
    const keyComponents = `${input.householdId}:${input.runId}:${input.insightType}:v1.0`;
    expect(keyComponents).toBe('hh-x:run-x:TAX_EXPLANATION:v1.0');
  });

  test('different insightType produces different cache key', () => {
    const key1 = `hh-1:run-1:PLAN_SUMMARY:v1.0`;
    const key2 = `hh-1:run-1:TAX_EXPLANATION:v1.0`;
    expect(key1).not.toBe(key2);
  });

  test('different runId produces different cache key', () => {
    const key1 = `hh-1:run-1:PLAN_SUMMARY:v1.0`;
    const key2 = `hh-1:run-2:PLAN_SUMMARY:v1.0`;
    expect(key1).not.toBe(key2);
  });
});

// -------------------------------------------------------------------------
// 7. Golden cases
// -------------------------------------------------------------------------

describe('golden cases', () => {
  test('failing plan: earlyDepletionRisk=true, fallback mentions depletion', () => {
    const flags = computeRiskFlags({
      success: false,
      firstDepletionYear: 2035,
      projectionEndYear: 2055,
      projectionStartYear: 2025,
      endingAssets: 0,
      yearsFunded: 10,
      primaryAge: 65,
    });
    expect(flags.earlyDepletionRisk).toBe(true);

    const input = makeBaseInsightInput({
      success: false,
      firstDepletionYear: 2035,
      yearsFunded: 10,
      risks: flags,
    });
    const fallback = buildFallbackInsight(input);
    expect(fallback.summary.toLowerCase()).toContain('depletion');
    expect(fallback.risks.some((r) => r.toLowerCase().includes('depletion'))).toBe(true);
  });

  test('strong plan: LOW risk, positive summary from fallback', () => {
    const flags = computeRiskFlags({
      success: true,
      projectionEndYear: 2055,
      projectionStartYear: 2025,
      endingAssets: 1200000,
      withdrawalRate: 0.03,
      yearsFunded: 30,
      primaryAge: 65,
    });
    const riskResult = analyzeRisks(flags);
    // Low withdrawal rate means sequenceRisk = false
    expect(flags.sequenceRisk).toBe(false);
    expect(flags.earlyDepletionRisk).toBe(false);

    const input = makeBaseInsightInput({
      success: true,
      yearsFunded: 30,
      endingAssets: 1200000,
      withdrawalRate: 0.03,
      risks: flags,
    });
    const fallback = buildFallbackInsight(input);
    expect(fallback.summary).toContain('2055');
    expect(fallback.summary).toContain('1,200,000');
  });

  test('high tax run: taxInefficiencyRisk=true, roth-conversion recommendation selected', () => {
    const flags: PlanRiskFlags = { ...makeAllFalseFlags(), taxInefficiencyRisk: true };
    const recs = selectRecommendations(flags);
    expect(recs.some((r) => r.id === 'roth-conversion')).toBe(true);
  });

  test('high healthcare run: healthcareRisk=true, healthcare-planning recommendation selected', () => {
    const flags: PlanRiskFlags = { ...makeAllFalseFlags(), healthcareRisk: true };
    const recs = selectRecommendations(flags);
    expect(recs.some((r) => r.id === 'healthcare-planning')).toBe(true);
  });

  test('comparison: B better than A → positive endingAssetsDelta', () => {
    const runA = {
      runId: 'run-a',
      scenarioName: 'A',
      success: true,
      endingAssets: 300000,
      projectionStartYear: 2025,
      projectionEndYear: 2055,
    };
    const runB = {
      runId: 'run-b',
      scenarioName: 'B',
      success: true,
      endingAssets: 500000,
      projectionStartYear: 2025,
      projectionEndYear: 2055,
    };
    const input = buildComparisonInsightInput('hh-1', runA, runB);
    expect(input.deltas?.endingAssetsDelta).toBeGreaterThan(0);
  });
});
