/**
 * Phase 14 — Conversational Planning Interface (AI Copilot Layer)
 *
 * PHILOSOPHY:
 * Conversation is a control layer, not a computation layer.
 * Every user message maps to: intent → structured action → engine call → insight → response.
 * The conversational system never performs financial math directly.
 *
 * LIMITATIONS (v1):
 * - Text-based intent parsing only (no voice)
 * - Intent classification uses keyword matching + AI fallback
 * - Tool execution calls existing deterministic services
 * - Conversation history stored in DB (24h TTL for active sessions)
 * - No multi-user conversation sharing
 * - No streaming responses yet (batch only)
 */

export type IntentType =
  | 'EXPLAIN'          // Explain existing plan/results
  | 'MODIFY'           // Modify a scenario parameter and re-run
  | 'COMPARE'          // Compare two scenarios
  | 'RISK'             // Explore risks
  | 'RECOMMEND'        // Get improvement suggestions
  | 'CLARIFY'          // User needs clarification on something
  | 'UNKNOWN';         // Could not parse intent

export type ActionType =
  | 'FETCH_PLAN_SUMMARY'
  | 'FETCH_SCENARIO_COMPARISON'
  | 'FETCH_RISK_ANALYSIS'
  | 'FETCH_RECOMMENDATIONS'
  | 'FETCH_TAX_SUMMARY'
  | 'FETCH_HEALTHCARE_SUMMARY'
  | 'FETCH_HOUSING_SUMMARY'
  | 'REQUEST_CLARIFICATION'
  | 'EXPLAIN_CONCEPT'
  | 'NO_ACTION';

export interface ParsedIntent {
  intentType: IntentType;
  actionType: ActionType;
  parameters: Record<string, string | number | boolean>;
  confidence: number;                // 0–1
  rawQuery: string;
  requiresClarification: boolean;
  clarificationQuestion?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  intentType?: IntentType;
  actionType?: ActionType;
  fromCache?: boolean;
  fromFallback?: boolean;
}

export interface ConversationContext {
  householdId: string;
  activeScenarioId?: string;
  activeRunId?: string;
  activeRunType?: 'tax' | 'healthcare' | 'housing' | 'monte_carlo' | 'simulation';
  recentIntents: IntentType[];
  planSummary?: {
    success: boolean;
    firstDepletionYear?: number;
    endingAssets: number;
    scenarioName: string;
  };
}

export interface ConversationSession {
  sessionId: string;
  householdId: string;
  userId: string;
  messages: ConversationMessage[];
  context: ConversationContext;
  createdAt: string;
  updatedAt: string;
}

export interface ActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  summary?: string;     // Short human-readable summary of the result
}

export interface CopilotResponse {
  messageId: string;
  content: string;              // AI-generated explanation/response
  structuredData?: Record<string, unknown>;  // Supporting data for UI rendering
  intentType: IntentType;
  actionType: ActionType;
  confidence: number;
  fromCache: boolean;
  fromFallback: boolean;
  suggestions?: string[];       // Follow-up question suggestions
}

export interface CopilotRequest {
  sessionId?: string;           // Existing session ID or undefined for new
  householdId: string;
  message: string;
  context?: Partial<ConversationContext>;
}

export interface ConversationValidation {
  valid: boolean;
  errors: string[];
}

// Concept explanations (deterministic, no AI needed)
export type RetirementConcept =
  | 'sequence_of_returns'
  | 'safe_withdrawal_rate'
  | 'roth_conversion'
  | 'required_minimum_distributions'
  | 'medicare'
  | 'social_security_optimization'
  | 'monte_carlo'
  | 'depletion_risk'
  | 'longevity_risk'
  | 'healthcare_bridge'
  | 'asset_allocation';

export const CONCEPT_EXPLANATIONS: Record<RetirementConcept, string> = {
  sequence_of_returns: 'Sequence-of-returns risk is the danger of experiencing poor investment returns early in retirement. Because withdrawals are taken regardless of market performance, a sharp decline early on permanently reduces the portfolio\'s ability to recover.',
  safe_withdrawal_rate: 'A safe withdrawal rate is the percentage of a retirement portfolio withdrawn annually, expressed as a portion of the starting portfolio value. The commonly referenced "4% rule" suggests that withdrawing 4% annually has historically sustained a 30-year retirement in most market conditions — though this is a guideline, not a guarantee.',
  roth_conversion: 'A Roth conversion involves moving money from a traditional (tax-deferred) retirement account to a Roth account. You pay income tax on the converted amount now, but future growth and withdrawals are tax-free. This can reduce future required minimum distributions and lower lifetime tax burden.',
  required_minimum_distributions: 'Required Minimum Distributions (RMDs) are mandatory annual withdrawals from tax-deferred accounts (like traditional IRAs and 401(k)s) starting at age 73 (as of 2024). They are calculated based on account balance and life expectancy tables.',
  medicare: 'Medicare is the federal health insurance program for people 65 and older. Part A covers hospital care; Part B covers outpatient care and has a monthly premium. Part D covers prescription drugs. Medigap (supplemental) plans or Medicare Advantage plans can reduce out-of-pocket costs.',
  social_security_optimization: 'Social Security benefits can be claimed from age 62 to 70. Claiming early reduces the monthly benefit permanently; delaying past full retirement age increases it by about 8% per year until 70. For couples, coordinating claim ages can maximize lifetime household benefits.',
  monte_carlo: 'Monte Carlo simulation runs hundreds or thousands of scenarios with randomly varying investment returns to estimate the probability that a retirement plan survives. A 90% success rate means the plan survived in 90 out of 100 simulated futures.',
  depletion_risk: 'Depletion risk is the probability that a retirement portfolio runs out of money before the end of the projection period. It is the primary output of retirement planning analysis.',
  longevity_risk: 'Longevity risk is the risk of outliving your retirement savings. People are living longer than ever, and plans that assume shorter lifespans may fail to fund an extended retirement.',
  healthcare_bridge: 'The healthcare bridge covers the period between early retirement and Medicare eligibility at age 65. Without employer coverage, retirees must purchase individual health insurance, which can cost $800–$2,000+ per month for a couple.',
  asset_allocation: 'Asset allocation is how a portfolio is divided among different investment types — stocks, bonds, cash, etc. A more stock-heavy allocation has higher expected returns but more volatility; a more bond-heavy allocation is more stable but grows more slowly.',
};

// Follow-up suggestion templates by intent type
export const FOLLOW_UP_SUGGESTIONS: Record<IntentType, string[]> = {
  EXPLAIN: [
    'What are the biggest risks in this plan?',
    'How does this compare to retiring later?',
    'What could improve this plan?',
  ],
  MODIFY: [
    'How does this compare to the baseline?',
    'What are the risks in the modified plan?',
    'Can I improve this further?',
  ],
  COMPARE: [
    'Which scenario has lower tax burden?',
    'What are the risks in the better scenario?',
    'Can you explain the tradeoffs?',
  ],
  RISK: [
    'What can I do to reduce these risks?',
    'How likely is early depletion?',
    'What does sequence risk mean for my plan?',
  ],
  RECOMMEND: [
    'How much would delaying retirement help?',
    'What is a Roth conversion and should I consider it?',
    'How would downsizing affect my plan?',
  ],
  CLARIFY: [
    'Tell me more about my overall plan',
    'What are the biggest risks?',
    'How can I improve this plan?',
  ],
  UNKNOWN: [
    'Does my plan work?',
    'What are the biggest risks in my plan?',
    'How can I improve my retirement plan?',
  ],
};
