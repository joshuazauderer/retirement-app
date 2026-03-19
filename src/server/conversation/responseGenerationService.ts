/**
 * responseGenerationService — generate AI-enhanced conversational responses.
 *
 * Takes a parsed intent + action result + conversation context and produces
 * a natural language response grounded in real plan data.
 *
 * Uses the Phase 13 AI provider abstraction (aiProviderService).
 * Falls back to deterministic template responses when AI is unavailable.
 */

import { callAiProvider } from '../ai/aiProviderService';
import { CONCEPT_EXPLANATIONS, FOLLOW_UP_SUGGESTIONS } from './types';
import type { ConversationContext, ParsedIntent, ActionResult, CopilotResponse } from './types';
import { buildSystemContextString } from './contextBuilderService';
import { detectConceptQuery } from './intentParserService';

const CONVERSATION_SYSTEM_PROMPT = `You are an AI planning assistant embedded in a retirement planning application called Viron.

Your role:
- Answer questions about the user's retirement plan in plain, clear language
- Explain financial concepts accessibly
- Help users understand risks and tradeoffs
- Guide them to take useful actions in the app

MANDATORY RULES:
- NEVER say "you should", "you must", "you need to", or give definitive financial advice
- Use language like "one option to consider", "this plan may benefit from", "it's worth exploring"
- NEVER invent numbers — only use numbers provided in the context
- ALWAYS stay grounded in the plan data provided
- Keep responses concise (2-4 paragraphs maximum)
- End responses with 1-2 helpful follow-up question suggestions if relevant
- Include a brief caveat: "This is a planning-grade explanation, not financial advice."

If the user asks something you cannot answer from the provided plan data, say so clearly and suggest what analysis to run.`;

function buildConversationUserPrompt(
  intent: ParsedIntent,
  actionResult: ActionResult,
  context: ConversationContext,
  recentMessages: Array<{ role: string; content: string }>,
): string {
  const contextStr = buildSystemContextString(context);
  const dataStr = actionResult.data ? JSON.stringify(actionResult.data, null, 2) : 'No data available';
  const historyStr = recentMessages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');

  return `HOUSEHOLD CONTEXT:
${contextStr}

PLAN DATA FOR THIS QUERY:
${dataStr}

ACTION SUMMARY: ${actionResult.summary ?? 'No summary'}

RECENT CONVERSATION:
${historyStr || 'No prior messages'}

USER QUERY: "${intent.rawQuery}"
INTENT: ${intent.intentType} (confidence: ${intent.confidence.toFixed(2)})

Please respond to the user's query in plain language, grounded in the plan data above.
Keep it concise and actionable. End with 1-2 follow-up suggestions.`;
}

/**
 * Generate a fallback response when AI is unavailable.
 */
export function buildFallbackResponse(
  intent: ParsedIntent,
  actionResult: ActionResult,
): string {
  if (!actionResult.success) {
    return `I wasn't able to retrieve the data needed to answer that question. ${actionResult.summary ?? ''} Please try running a planning analysis first and then ask again.`;
  }

  switch (intent.intentType) {
    case 'EXPLAIN':
      return `${actionResult.summary ?? 'Here is a summary of your plan.'} For more detail, review the year-by-year projections in the analysis pages. This is a planning-grade estimate, not financial advice.`;
    case 'RISK':
      return `${actionResult.summary ?? 'Risk analysis complete.'} Review the Risk Analysis section for details on each identified risk. This is a planning-grade estimate, not financial advice.`;
    case 'RECOMMEND':
      return `${actionResult.summary ?? 'Recommendations identified.'} Review the suggestions in the AI Insights section. This is a planning-grade estimate, not financial advice.`;
    case 'COMPARE':
      return `${actionResult.summary ?? 'Comparison data retrieved.'} Use the Compare page to see a detailed side-by-side view. This is a planning-grade estimate, not financial advice.`;
    default:
      return `${actionResult.summary ?? 'I\'ve reviewed your plan data.'} Explore the detailed analysis pages for more information. This is a planning-grade estimate, not financial advice.`;
  }
}

/**
 * Sanitize response to remove forbidden authoritative phrases.
 */
export function sanitizeResponse(text: string): string {
  const replacements: [string, string][] = [
    ['you should', 'one option to consider is'],
    ['you must', 'it may be important to'],
    ['you need to', 'it may be worth exploring'],
    ['I recommend you', 'one approach to consider is'],
    ['guaranteed', 'projected'],
    ['will definitely', 'may'],
  ];
  let result = text;
  for (const [forbidden, replacement] of replacements) {
    result = result.replace(new RegExp(forbidden, 'gi'), replacement);
  }
  return result;
}

/**
 * Generate a conversational response for a user query.
 */
export async function generateConversationalResponse(
  intent: ParsedIntent,
  actionResult: ActionResult,
  context: ConversationContext,
  recentMessages: Array<{ role: string; content: string }>,
  messageId: string,
): Promise<CopilotResponse> {
  // Handle concept queries deterministically (no AI needed)
  const conceptKey = detectConceptQuery(intent.rawQuery);
  if (conceptKey && conceptKey in CONCEPT_EXPLANATIONS) {
    const explanation = CONCEPT_EXPLANATIONS[conceptKey as keyof typeof CONCEPT_EXPLANATIONS];
    return {
      messageId,
      content: `${explanation}\n\n*This is a general planning-grade explanation, not personalized financial advice.*`,
      intentType: intent.intentType,
      actionType: intent.actionType,
      confidence: intent.confidence,
      fromCache: false,
      fromFallback: true,
      suggestions: FOLLOW_UP_SUGGESTIONS[intent.intentType]?.slice(0, 2),
    };
  }

  // Handle clarification requests deterministically
  if (intent.intentType === 'UNKNOWN' || intent.requiresClarification) {
    return {
      messageId,
      content: intent.clarificationQuestion ?? 'Could you rephrase that? Try asking: "Does my plan work?", "What are the biggest risks?", or "How can I improve my plan?"',
      intentType: intent.intentType,
      actionType: intent.actionType,
      confidence: intent.confidence,
      fromCache: false,
      fromFallback: true,
      suggestions: FOLLOW_UP_SUGGESTIONS['UNKNOWN'],
    };
  }

  // Try AI response
  try {
    const userPrompt = buildConversationUserPrompt(intent, actionResult, context, recentMessages);
    const { raw } = await callAiProvider(CONVERSATION_SYSTEM_PROMPT, userPrompt);

    const sanitized = sanitizeResponse(raw);
    const suggestions = FOLLOW_UP_SUGGESTIONS[intent.intentType]?.slice(0, 2) ?? [];

    return {
      messageId,
      content: sanitized,
      structuredData: actionResult.data,
      intentType: intent.intentType,
      actionType: intent.actionType,
      confidence: intent.confidence,
      fromCache: false,
      fromFallback: false,
      suggestions,
    };
  } catch {
    const fallback = buildFallbackResponse(intent, actionResult);
    return {
      messageId,
      content: fallback,
      structuredData: actionResult.data,
      intentType: intent.intentType,
      actionType: intent.actionType,
      confidence: intent.confidence,
      fromCache: false,
      fromFallback: true,
      suggestions: FOLLOW_UP_SUGGESTIONS[intent.intentType]?.slice(0, 2),
    };
  }
}
