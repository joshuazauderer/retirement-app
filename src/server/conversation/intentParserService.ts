/**
 * intentParserService — parse user messages into structured intents.
 *
 * Uses two-stage parsing:
 * 1. Keyword/pattern matching (deterministic, fast, no API call)
 * 2. AI classification fallback for ambiguous messages
 *
 * Keyword matching covers the majority of common queries.
 * AI fallback handles complex or unusual phrasing.
 */

import type { ParsedIntent, IntentType, ActionType } from './types';

// Keyword patterns for each intent type
const INTENT_PATTERNS: Array<{
  intentType: IntentType;
  actionType: ActionType;
  patterns: RegExp[];
  confidence: number;
}> = [
  // EXPLAIN patterns
  {
    intentType: 'EXPLAIN',
    actionType: 'FETCH_PLAN_SUMMARY',
    patterns: [
      /\b(explain|what is|tell me about|summarize|overview|how does|does my plan|will (i|my plan)|am i on track)\b/i,
      /\b(plan work|plan fail|plan look|plan doing|plan status)\b/i,
      /\bwhy (does|did|is|will)\b/i,
    ],
    confidence: 0.85,
  },
  // RISK patterns
  {
    intentType: 'RISK',
    actionType: 'FETCH_RISK_ANALYSIS',
    patterns: [
      /\b(risk|risks|risky|vulnerable|danger|dangerous|concern|worried|worry|what could go wrong|what (are|is) the (biggest|main|top|key) risk)\b/i,
      /\b(sequence.of.return|longevity risk|depletion risk|sequence risk|healthcare risk|tax risk)\b/i,
    ],
    confidence: 0.9,
  },
  // RECOMMEND patterns
  {
    intentType: 'RECOMMEND',
    actionType: 'FETCH_RECOMMENDATIONS',
    patterns: [
      /\b(improve|better|optimization|optimize|suggestion|suggest|recommend|recommendation|what (should|could|can) i (do|change|adjust)|how (can|could) i improve|what would help)\b/i,
      /\b(fix|fix this|make (it|this) better|stronger|more durable)\b/i,
    ],
    confidence: 0.88,
  },
  // COMPARE patterns
  {
    intentType: 'COMPARE',
    actionType: 'FETCH_SCENARIO_COMPARISON',
    patterns: [
      /\b(compare|comparison|versus|vs\.?|against|difference|which is better|side.by.side|compared to)\b/i,
      /\bhow does .+ compare\b/i,
    ],
    confidence: 0.9,
  },
  // MODIFY patterns — "what if" scenarios
  {
    intentType: 'MODIFY',
    actionType: 'FETCH_PLAN_SUMMARY',
    patterns: [
      /\b(what if|if i|suppose i|assume i|hypothetically|scenario where|let's say|imagine if)\b/i,
      /\b(retire (at|earlier|later|sooner)|spend (less|more)|reduce (spending|withdrawals)|downsize|roth conversion|convert|move to)\b/i,
    ],
    confidence: 0.82,
  },
  // TAX specific
  {
    intentType: 'EXPLAIN',
    actionType: 'FETCH_TAX_SUMMARY',
    patterns: [
      /\b(tax|taxes|taxation|irs|roth|traditional|deferred|federal tax|state tax|tax burden|tax efficient)\b/i,
    ],
    confidence: 0.8,
  },
  // HEALTHCARE specific
  {
    intentType: 'EXPLAIN',
    actionType: 'FETCH_HEALTHCARE_SUMMARY',
    patterns: [
      /\b(healthcare|health care|medical|medicare|medicaid|insurance|medigap|long.term care|ltc|prescription)\b/i,
    ],
    confidence: 0.8,
  },
  // HOUSING specific
  {
    intentType: 'EXPLAIN',
    actionType: 'FETCH_HOUSING_SUMMARY',
    patterns: [
      /\b(housing|house|home|downsize|downsizing|relocate|relocation|move|equity|mortgage|legacy|estate|inheritance)\b/i,
    ],
    confidence: 0.8,
  },
  // CONCEPT explanation
  {
    intentType: 'CLARIFY',
    actionType: 'EXPLAIN_CONCEPT',
    patterns: [
      /\b(what is|what are|explain|define|definition of|how does .+ work|what does .+ mean)\b/i,
      /\b(sequence of returns|safe withdrawal|roth conversion|required minimum|rmd|monte carlo|medicare|social security|asset allocation)\b/i,
    ],
    confidence: 0.75,
  },
];

// Parameter extraction patterns
function extractParameters(message: string): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};

  // Age extraction: "retire at 62", "at age 65", "age 60"
  const ageMatch = message.match(/\b(?:at\s+)?age\s+(\d{2})\b|\bretire\s+at\s+(\d{2})\b|\b(\d{2})\s*years?\s+old\b/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1] ?? ageMatch[2] ?? ageMatch[3]);
    if (age >= 50 && age <= 80) params.retirementAge = age;
  }

  // Spending/withdrawal amount: "$3,000/month", "$50,000 per year"
  const spendMatch = message.match(/\$?([\d,]+)\s*(?:\/\s*(?:month|year|yr|mo)|per\s+(?:month|year))/i);
  if (spendMatch) {
    const amount = parseInt(spendMatch[1].replace(/,/g, ''));
    if (message.match(/month|mo/i)) {
      params.annualSpending = amount * 12;
    } else {
      params.annualSpending = amount;
    }
  }

  // Withdrawal rate: "4%", "3.5 percent"
  const rateMatch = message.match(/(\d+(?:\.\d+)?)\s*%\s*(?:withdrawal|spending|rate)?/i);
  if (rateMatch) {
    const rate = parseFloat(rateMatch[1]);
    if (rate >= 1 && rate <= 15) params.withdrawalRate = rate / 100;
  }

  // State mention
  const stateMatch = message.match(/\b(florida|texas|nevada|washington|wyoming|alaska|south dakota|tennessee|new hampshire)\b/i);
  if (stateMatch) {
    const stateMap: Record<string, string> = {
      florida: 'FL', texas: 'TX', nevada: 'NV', washington: 'WA',
      wyoming: 'WY', alaska: 'AK', 'south dakota': 'SD', tennessee: 'TN',
      'new hampshire': 'NH',
    };
    params.state = stateMap[stateMatch[1].toLowerCase()] ?? stateMatch[1].toUpperCase().slice(0, 2);
  }

  // Dollar amount: "$500,000", "500k", "1 million"
  const dollarMatch = message.match(/\$([\d,]+(?:\.\d+)?)\s*(k|thousand|million|m)?\b/i);
  if (dollarMatch && !spendMatch) {
    let amount = parseFloat(dollarMatch[1].replace(/,/g, ''));
    const unit = dollarMatch[2]?.toLowerCase();
    if (unit === 'k' || unit === 'thousand') amount *= 1000;
    if (unit === 'm' || unit === 'million') amount *= 1000000;
    params.amount = amount;
  }

  return params;
}

/**
 * Parse a user message into a structured intent using keyword matching.
 * Returns highest-confidence matching intent.
 */
export function parseIntent(message: string): ParsedIntent {
  const trimmed = message.trim();
  let bestMatch: { intentType: IntentType; actionType: ActionType; confidence: number } | null = null;

  for (const pattern of INTENT_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(trimmed)) {
        if (!bestMatch || pattern.confidence > bestMatch.confidence) {
          bestMatch = {
            intentType: pattern.intentType,
            actionType: pattern.actionType,
            confidence: pattern.confidence,
          };
        }
        break;
      }
    }
  }

  const parameters = extractParameters(trimmed);

  // If no match found, return UNKNOWN with low confidence
  if (!bestMatch) {
    return {
      intentType: 'UNKNOWN',
      actionType: 'NO_ACTION',
      parameters,
      confidence: 0.1,
      rawQuery: trimmed,
      requiresClarification: true,
      clarificationQuestion: 'Could you tell me more about what you\'d like to know? For example: "Does my plan work?", "What are the biggest risks?", or "How can I improve my plan?"',
    };
  }

  // Low confidence → ask for clarification
  const requiresClarification = bestMatch.confidence < 0.6;

  return {
    intentType: bestMatch.intentType,
    actionType: bestMatch.actionType,
    parameters,
    confidence: bestMatch.confidence,
    rawQuery: trimmed,
    requiresClarification,
    clarificationQuestion: requiresClarification
      ? `I want to make sure I understand correctly. Are you asking about: ${bestMatch.intentType.toLowerCase()}ing your plan? Could you rephrase or add more detail?`
      : undefined,
  };
}

/**
 * Detect if a message is asking about a specific retirement concept.
 */
export function detectConceptQuery(message: string): string | null {
  const conceptPatterns: Record<string, RegExp> = {
    sequence_of_returns: /sequence.of.return/i,
    safe_withdrawal_rate: /safe.withdrawal|4%.rule|withdrawal.rate/i,
    roth_conversion: /roth.conversion|convert.to.roth/i,
    required_minimum_distributions: /required.minimum|rmd/i,
    medicare: /\bmedicare\b/i,
    social_security_optimization: /social.security.optim|when.to.claim/i,
    monte_carlo: /monte.carlo|probability.of.success/i,
    depletion_risk: /depletion.risk|run.out/i,
    longevity_risk: /longevity.risk|outlive/i,
    healthcare_bridge: /healthcare.bridge|pre.medicare/i,
    asset_allocation: /asset.allocation|stock.bond.mix/i,
  };

  for (const [concept, pattern] of Object.entries(conceptPatterns)) {
    if (pattern.test(message)) return concept;
  }
  return null;
}
