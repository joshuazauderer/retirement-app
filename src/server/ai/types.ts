/**
 * Phase 13 — AI Insight Engine + Plan Explanation Layer
 *
 * PHILOSOPHY:
 * AI is an interpreter, not a calculator.
 * The AI layer explains results from the deterministic engine.
 * It never performs financial calculations or overrides engine outputs.
 *
 * LIMITATIONS (v1):
 * - AI insights are generated explanations, not financial advice
 * - Outputs depend on quality of structured input from stored simulation runs
 * - Responses are bounded by guardrails to avoid definitive recommendations
 * - Caching is keyed to scenarioId + runId + promptVersion
 * - No streaming yet (batch response only)
 */

export type InsightType =
  | 'PLAN_SUMMARY'
  | 'RISK_DETECTION'
  | 'SCENARIO_COMPARISON'
  | 'RECOMMENDATION'
  | 'TAX_EXPLANATION'
  | 'HEALTHCARE_EXPLANATION'
  | 'HOUSING_LEGACY_EXPLANATION';

export type AiProvider = 'openai' | 'anthropic';

// --- Structured Input Schema ---
// AI receives ONLY structured data derived from existing stored outputs.
// Never pass raw engine objects.

export interface PlanRiskFlags {
  earlyDepletionRisk: boolean;       // Plan depletes before expected horizon
  sequenceRisk: boolean;             // High early-withdrawal exposure in volatile years
  longevityRisk: boolean;            // Horizon may not be long enough
  taxInefficiencyRisk: boolean;      // High effective tax rate or missed Roth opportunity
  healthcareRisk: boolean;           // Large healthcare cost burden
  concentrationRisk: boolean;        // Highly concentrated in one account type
}

export interface InsightInput {
  // Identity
  householdId: string;
  scenarioName: string;
  runId: string;
  insightType: InsightType;

  // Plan state
  success: boolean;
  firstDepletionYear?: number;
  projectionStartYear: number;
  projectionEndYear: number;
  endingAssets: number;
  yearsFunded: number;
  withdrawalRate?: number;            // e.g. 0.04 = 4%

  // Key financial metrics
  totalTaxes?: number;
  totalHealthcareCost?: number;
  netEstateValue?: number;
  netEquityReleased?: number;

  // Primary person context
  primaryAge: number;
  retirementYear?: number;

  // Risk flags (pre-computed by riskAnalysisService)
  risks: PlanRiskFlags;

  // Comparison deltas (for SCENARIO_COMPARISON type)
  deltas?: {
    endingAssetsDelta?: number;
    firstDepletionYearDelta?: number;
    totalTaxDelta?: number;
    totalHealthcareDelta?: number;
    netEstateValueDelta?: number;
  };

  // Optional context for specific report types
  rothConversionEnabled?: boolean;
  hasLtcStress?: boolean;
  hasLongevityStress?: boolean;
  longevityTargetAge?: number;
  housingStrategy?: string;
  filingStatus?: string;
  stateCode?: string;
}

// --- Structured Output Schema ---
// AI must return this exact shape. Responses that deviate are rejected.

export interface InsightOutput {
  summary: string;                    // 2-4 sentence plain-language plan summary
  keyInsights: string[];              // 3-5 bullet insights
  risks: string[];                    // Identified risk factors (from risk flags)
  recommendations: string[];          // Bounded, non-authoritative suggestions
  confidenceNotes: string[];          // Uncertainty framing and caveats
}

// --- Prompt versioning ---

export interface PromptVersion {
  version: string;                    // e.g. 'v1.0'
  insightType: InsightType;
  systemPrompt: string;
  userPromptTemplate: string;         // Template with {placeholders}
}

// --- Cache ---

export interface AiCacheEntry {
  cacheKey: string;
  insightType: InsightType;
  input: InsightInput;
  output: InsightOutput;
  promptVersion: string;
  generatedAt: string;
  provider: AiProvider;
}

// --- Risk analysis output ---

export interface RiskAnalysisResult {
  flags: PlanRiskFlags;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskCount: number;
  primaryRisk?: string;               // The most important risk to surface first
}

// --- Recommendation ---

export interface Recommendation {
  id: string;
  suggestion: string;                 // Non-authoritative phrasing
  reason: string;
  potentialImpact: string;
  tradeoff: string;
  applicableWhen: string;            // When this recommendation is relevant
}

// --- Validation ---

export interface InsightValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// --- Provider config ---

export interface AiProviderConfig {
  provider: AiProvider;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Guardrail constants
export const GUARDRAIL_FORBIDDEN_PHRASES = [
  'you should',
  'you must',
  'you need to',
  'I recommend you',
  'guaranteed',
  'will definitely',
  'certain to',
];

export const GUARDRAIL_REQUIRED_HEDGES = [
  'may benefit from',
  'one option to consider',
  'could potentially',
  'worth exploring',
  'depending on circumstances',
  'a financial professional',
];

export const AI_PROMPT_VERSION = 'v1.0';
