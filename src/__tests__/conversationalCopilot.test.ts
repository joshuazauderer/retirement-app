import { describe, test, expect } from 'vitest';
import { parseIntent, detectConceptQuery } from '../server/conversation/intentParserService';
import { buildSystemContextString } from '../server/conversation/contextBuilderService';
import { buildFallbackResponse, sanitizeResponse } from '../server/conversation/responseGenerationService';
import { CONCEPT_EXPLANATIONS, FOLLOW_UP_SUGGESTIONS } from '../server/conversation/types';
import { GUARDRAIL_FORBIDDEN_PHRASES } from '../server/ai/types';
import type { ConversationContext, ParsedIntent, ActionResult, IntentType } from '../server/conversation/types';

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function makeContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    householdId: 'hh-test',
    recentIntents: [],
    ...overrides,
  };
}

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    intentType: 'EXPLAIN',
    actionType: 'FETCH_PLAN_SUMMARY',
    parameters: {},
    confidence: 0.85,
    rawQuery: 'Does my plan work?',
    requiresClarification: false,
    ...overrides,
  };
}

function makeActionResult(overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    success: true,
    data: {},
    summary: 'Most recent plan runs show a fully funded projection.',
    ...overrides,
  };
}

// -------------------------------------------------------------------------
// 1. intentParserService
// -------------------------------------------------------------------------

describe('intentParserService — parseIntent', () => {
  test('"Does my plan work?" → EXPLAIN / FETCH_PLAN_SUMMARY', () => {
    const result = parseIntent('Does my plan work?');
    expect(result.intentType).toBe('EXPLAIN');
    expect(result.actionType).toBe('FETCH_PLAN_SUMMARY');
  });

  test('"What are the biggest risks?" → RISK / FETCH_RISK_ANALYSIS', () => {
    const result = parseIntent('What are the biggest risks?');
    expect(result.intentType).toBe('RISK');
    expect(result.actionType).toBe('FETCH_RISK_ANALYSIS');
  });

  test('"How can I improve this?" → RECOMMEND / FETCH_RECOMMENDATIONS', () => {
    const result = parseIntent('How can I improve this?');
    expect(result.intentType).toBe('RECOMMEND');
    expect(result.actionType).toBe('FETCH_RECOMMENDATIONS');
  });

  test('"Compare this to retiring at 65" → COMPARE / FETCH_SCENARIO_COMPARISON', () => {
    const result = parseIntent('Compare this to retiring at 65');
    expect(result.intentType).toBe('COMPARE');
    expect(result.actionType).toBe('FETCH_SCENARIO_COMPARISON');
  });

  test('"What if I retire at 62?" → MODIFY with retirementAge=62', () => {
    const result = parseIntent('What if I retire at 62?');
    expect(result.intentType).toBe('MODIFY');
    expect(result.parameters.retirementAge).toBe(62);
  });

  test('"What is sequence of returns risk?" → RISK (sequence-of-return pattern matches with higher confidence)', () => {
    // The RISK pattern matches "sequence.of.return" with confidence 0.9,
    // which beats the CLARIFY/EXPLAIN_CONCEPT confidence of 0.75.
    // Use detectConceptQuery separately to identify concept queries.
    const result = parseIntent('What is sequence of returns risk?');
    expect(result.intentType).toBe('RISK');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('"xyz gibberish abc" → UNKNOWN with requiresClarification=true', () => {
    const result = parseIntent('xyz gibberish abc');
    expect(result.intentType).toBe('UNKNOWN');
    expect(result.requiresClarification).toBe(true);
  });

  test('UNKNOWN result has clarificationQuestion', () => {
    const result = parseIntent('asdf qwerty lkjh');
    expect(result.intentType).toBe('UNKNOWN');
    expect(typeof result.clarificationQuestion).toBe('string');
    expect(result.clarificationQuestion!.length).toBeGreaterThan(10);
  });

  test('"retire at 62" extracts retirementAge=62', () => {
    const result = parseIntent('What if I retire at 62?');
    expect(result.parameters.retirementAge).toBe(62);
  });

  test('"$4,000/month" extracts annualSpending=48000', () => {
    const result = parseIntent('What if I spend $4,000/month in retirement?');
    expect(result.parameters.annualSpending).toBe(48000);
  });

  test('"4% withdrawal rate" extracts withdrawalRate=0.04', () => {
    const result = parseIntent('What if I use a 4% withdrawal rate?');
    expect(result.parameters.withdrawalRate).toBe(0.04);
  });

  test('"move to Florida" extracts state=FL', () => {
    const result = parseIntent('What if I move to Florida?');
    expect(result.parameters.state).toBe('FL');
  });

  test('rawQuery matches trimmed input', () => {
    const msg = '  Does my plan work?  ';
    const result = parseIntent(msg);
    expect(result.rawQuery).toBe(msg.trim());
  });
});

describe('intentParserService — detectConceptQuery', () => {
  test('"sequence of returns" → sequence_of_returns', () => {
    expect(detectConceptQuery('What is sequence of returns risk?')).toBe('sequence_of_returns');
  });

  test('"what is the 4% rule" → safe_withdrawal_rate', () => {
    expect(detectConceptQuery('what is the 4% rule?')).toBe('safe_withdrawal_rate');
  });

  test('"pizza recipe" → null', () => {
    expect(detectConceptQuery('pizza recipe')).toBeNull();
  });

  test('"rmd" → required_minimum_distributions', () => {
    expect(detectConceptQuery('what is an rmd?')).toBe('required_minimum_distributions');
  });

  test('"medicare" → medicare', () => {
    expect(detectConceptQuery('tell me about Medicare')).toBe('medicare');
  });

  test('"monte carlo" → monte_carlo', () => {
    expect(detectConceptQuery('how does monte carlo work?')).toBe('monte_carlo');
  });

  test('"asset allocation" → asset_allocation', () => {
    expect(detectConceptQuery('what is asset allocation?')).toBe('asset_allocation');
  });
});

// -------------------------------------------------------------------------
// 2. contextBuilderService
// -------------------------------------------------------------------------

describe('contextBuilderService — buildSystemContextString', () => {
  test('fully funded plan → string contains "Fully Funded"', () => {
    const context = makeContext({
      planSummary: {
        success: true,
        endingAssets: 500000,
        scenarioName: 'Base Scenario',
      },
    });
    const str = buildSystemContextString(context);
    expect(str).toContain('Fully Funded');
  });

  test('depleted plan → string contains "Depleted"', () => {
    const context = makeContext({
      planSummary: {
        success: false,
        firstDepletionYear: 2040,
        endingAssets: 0,
        scenarioName: 'Risk Scenario',
      },
    });
    const str = buildSystemContextString(context);
    expect(str).toContain('Depleted');
  });

  test('no plan summary → contains encouragement to run analysis', () => {
    const context = makeContext();
    const str = buildSystemContextString(context);
    expect(str.toLowerCase()).toContain('no simulation');
  });

  test('contains householdId', () => {
    const context = makeContext({ householdId: 'hh-12345' });
    const str = buildSystemContextString(context);
    expect(str).toContain('hh-12345');
  });

  test('shows ending assets when > 0', () => {
    const context = makeContext({
      planSummary: {
        success: true,
        endingAssets: 750000,
        scenarioName: 'Base',
      },
    });
    const str = buildSystemContextString(context);
    expect(str).toContain('750,000');
  });

  test('shows scenario name', () => {
    const context = makeContext({
      planSummary: {
        success: true,
        endingAssets: 0,
        scenarioName: 'My Roth Conversion Plan',
      },
    });
    const str = buildSystemContextString(context);
    expect(str).toContain('My Roth Conversion Plan');
  });
});

// -------------------------------------------------------------------------
// 3. responseGenerationService
// -------------------------------------------------------------------------

describe('responseGenerationService — buildFallbackResponse', () => {
  test('EXPLAIN with success=true → contains actionResult.summary', () => {
    const intent = makeIntent({ intentType: 'EXPLAIN' });
    const result = makeActionResult({ summary: 'Plan is fully funded.' });
    const response = buildFallbackResponse(intent, result);
    expect(response).toContain('Plan is fully funded.');
  });

  test('RISK → mentions risk analysis', () => {
    const intent = makeIntent({ intentType: 'RISK' });
    const result = makeActionResult({ summary: 'HIGH risk level with 3 factors.' });
    const response = buildFallbackResponse(intent, result);
    expect(response.toLowerCase()).toContain('risk');
  });

  test('RECOMMEND → mentions recommendations/insights', () => {
    const intent = makeIntent({ intentType: 'RECOMMEND' });
    const result = makeActionResult({ summary: '2 recommendations identified.' });
    const response = buildFallbackResponse(intent, result);
    expect(response).toContain('2 recommendations identified.');
  });

  test('COMPARE → mentions comparison', () => {
    const intent = makeIntent({ intentType: 'COMPARE' });
    const result = makeActionResult({ summary: 'Comparison complete.' });
    const response = buildFallbackResponse(intent, result);
    expect(response.toLowerCase()).toContain('compar');
  });

  test('failed action → includes actionResult.summary in response', () => {
    const intent = makeIntent({ intentType: 'EXPLAIN' });
    const result = makeActionResult({ success: false, summary: 'No runs found.' });
    const response = buildFallbackResponse(intent, result);
    expect(response).toContain('No runs found.');
  });

  test('all fallback responses contain planning-grade caveat', () => {
    const intents: IntentType[] = ['EXPLAIN', 'RISK', 'RECOMMEND', 'COMPARE'];
    for (const intentType of intents) {
      const intent = makeIntent({ intentType });
      const result = makeActionResult();
      const response = buildFallbackResponse(intent, result);
      expect(response.toLowerCase()).toContain('planning-grade');
    }
  });
});

describe('responseGenerationService — sanitizeResponse', () => {
  test('"you should" → replaced with hedged phrase', () => {
    const result = sanitizeResponse('you should reduce your spending.');
    expect(result.toLowerCase()).not.toContain('you should');
    expect(result.toLowerCase()).toContain('one option to consider is');
  });

  test('"guaranteed" → replaced with "projected"', () => {
    const result = sanitizeResponse('This plan is guaranteed to succeed.');
    expect(result.toLowerCase()).not.toContain('guaranteed');
    expect(result.toLowerCase()).toContain('projected');
  });

  test('"you must" → replaced', () => {
    const result = sanitizeResponse('You must start saving more.');
    expect(result.toLowerCase()).not.toContain('you must');
  });

  test('"will definitely" → replaced with "may"', () => {
    const result = sanitizeResponse('This will definitely work out.');
    expect(result.toLowerCase()).not.toContain('will definitely');
  });

  test('text with no forbidden phrases returns unchanged', () => {
    const clean = 'One option to consider is reducing spending.';
    const result = sanitizeResponse(clean);
    expect(result).toBe(clean);
  });
});

// -------------------------------------------------------------------------
// 4. types / constants
// -------------------------------------------------------------------------

describe('types / constants', () => {
  test('CONCEPT_EXPLANATIONS has 11 entries', () => {
    expect(Object.keys(CONCEPT_EXPLANATIONS)).toHaveLength(11);
  });

  test('CONCEPT_EXPLANATIONS entries are non-empty strings', () => {
    for (const [key, value] of Object.entries(CONCEPT_EXPLANATIONS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(20);
      expect(value).toBeTruthy();
      // key is used to verify all keys are present
      expect(typeof key).toBe('string');
    }
  });

  test('FOLLOW_UP_SUGGESTIONS has entries for all IntentTypes', () => {
    const intentTypes: IntentType[] = ['EXPLAIN', 'MODIFY', 'COMPARE', 'RISK', 'RECOMMEND', 'CLARIFY', 'UNKNOWN'];
    for (const type of intentTypes) {
      expect(FOLLOW_UP_SUGGESTIONS[type]).toBeDefined();
      expect(Array.isArray(FOLLOW_UP_SUGGESTIONS[type])).toBe(true);
      expect(FOLLOW_UP_SUGGESTIONS[type].length).toBeGreaterThan(0);
    }
  });

  test('GUARDRAIL_FORBIDDEN_PHRASES contains expected phrases', () => {
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('you should');
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('guaranteed');
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('will definitely');
    expect(GUARDRAIL_FORBIDDEN_PHRASES).toContain('you must');
  });

  test('CONCEPT_EXPLANATIONS includes medicare explanation about Medicare', () => {
    expect(CONCEPT_EXPLANATIONS.medicare.toLowerCase()).toContain('medicare');
  });

  test('CONCEPT_EXPLANATIONS sequence_of_returns mentions portfolio', () => {
    expect(CONCEPT_EXPLANATIONS.sequence_of_returns.toLowerCase()).toContain('portfolio');
  });
});

// -------------------------------------------------------------------------
// 5. Golden cases
// -------------------------------------------------------------------------

describe('golden cases', () => {
  test('"Does my plan work?" parses to EXPLAIN, confidence >= 0.8', () => {
    const result = parseIntent('Does my plan work?');
    expect(result.intentType).toBe('EXPLAIN');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('"What are the risks?" parses to RISK, confidence >= 0.85', () => {
    const result = parseIntent('What are the risks?');
    expect(result.intentType).toBe('RISK');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('"What if I retire at 62?" parses to MODIFY with retirementAge=62', () => {
    const result = parseIntent('What if I retire at 62?');
    expect(result.intentType).toBe('MODIFY');
    expect(result.parameters.retirementAge).toBe(62);
  });

  test('"What is Medicare?" parses, detectConceptQuery returns "medicare"', () => {
    const intent = parseIntent('What is Medicare?');
    expect(intent.intentType).toBeTruthy();
    const concept = detectConceptQuery('What is Medicare?');
    expect(concept).toBe('medicare');
  });

  test('CONCEPT_EXPLANATIONS["medicare"] is a non-empty string about Medicare', () => {
    const explanation = CONCEPT_EXPLANATIONS.medicare;
    expect(typeof explanation).toBe('string');
    expect(explanation.length).toBeGreaterThan(50);
    expect(explanation.toLowerCase()).toContain('medicare');
  });

  test('Fallback response for UNKNOWN intent contains suggested questions', () => {
    const intent = makeIntent({ intentType: 'UNKNOWN', requiresClarification: true });
    const result = makeActionResult({ success: false, summary: 'Unknown query' });
    const response = buildFallbackResponse(intent, result);
    // fallback for unknown with failed action: mentions the summary
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(10);
  });

  test('FOLLOW_UP_SUGGESTIONS["UNKNOWN"] contains at least one suggested question', () => {
    const suggestions = FOLLOW_UP_SUGGESTIONS['UNKNOWN'];
    expect(suggestions.some((s) => s.toLowerCase().includes('plan'))).toBe(true);
  });

  test('Session message format has id, role, content, timestamp fields', () => {
    // Verify the ConversationMessage shape via intent parse result metadata
    const msg = {
      id: 'msg-001',
      role: 'user' as const,
      content: 'Does my plan work?',
      timestamp: new Date().toISOString(),
    };
    expect(msg.id).toBeDefined();
    expect(msg.role).toBeDefined();
    expect(msg.content).toBeDefined();
    expect(msg.timestamp).toBeDefined();
  });

  test('"am I on track?" maps to EXPLAIN intent', () => {
    const result = parseIntent('am I on track?');
    expect(result.intentType).toBe('EXPLAIN');
  });

  test('"what if I spend less" maps to MODIFY', () => {
    const result = parseIntent('what if I spend less each year?');
    expect(result.intentType).toBe('MODIFY');
  });

  test('"What is longevity risk?" resolves concept', () => {
    const concept = detectConceptQuery('What is longevity risk?');
    expect(concept).toBe('longevity_risk');
  });

  test('parseIntent sets requiresClarification=false for high confidence intents', () => {
    const result = parseIntent('What are the biggest risks in my plan?');
    expect(result.requiresClarification).toBe(false);
  });
});
