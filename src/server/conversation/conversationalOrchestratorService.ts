/**
 * conversationalOrchestratorService — main entry point for the copilot.
 *
 * Orchestrates the full flow:
 * 1. Load or create session
 * 2. Build context
 * 3. Parse intent
 * 4. Route action
 * 5. Generate response
 * 6. Save to session
 * 7. Return CopilotResponse
 */

import { randomUUID } from 'crypto';
import { parseIntent } from './intentParserService';
import { routeAction } from './actionRouterService';
import { generateConversationalResponse } from './responseGenerationService';
import { buildConversationContext } from './contextBuilderService';
import { createSession, loadSession, appendMessage } from './conversationStateService';
import type { CopilotRequest, CopilotResponse, ConversationMessage } from './types';

/**
 * Main copilot handler — process a user message and return a response.
 */
export async function handleCopilotMessage(
  request: CopilotRequest,
  userId: string,
): Promise<CopilotResponse & { sessionId: string }> {
  // 1. Load or create session
  let session = request.sessionId
    ? await loadSession(request.sessionId, userId)
    : null;

  const context = await buildConversationContext(
    request.householdId,
    userId,
    request.context?.activeScenarioId,
  );

  if (!session) {
    session = await createSession(request.householdId, userId, context);
  }

  // 2. Save user message
  const userMessageId = randomUUID();
  const userMessage: ConversationMessage = {
    id: userMessageId,
    role: 'user',
    content: request.message,
    timestamp: new Date().toISOString(),
  };
  await appendMessage(session.sessionId, userMessage);

  // 3. Parse intent
  const intent = parseIntent(request.message);

  // 4. Route action
  const actionResult = await routeAction(intent, request.householdId, userId);

  // 5. Generate response
  const assistantMessageId = randomUUID();
  const recentMessages = session.messages.slice(-6).map(m => ({
    role: m.role,
    content: m.content,
  }));

  const response = await generateConversationalResponse(
    intent,
    actionResult,
    context,
    recentMessages,
    assistantMessageId,
  );

  // 6. Save assistant message
  const assistantMessage: ConversationMessage = {
    id: assistantMessageId,
    role: 'assistant',
    content: response.content,
    timestamp: new Date().toISOString(),
    intentType: response.intentType,
    actionType: response.actionType,
    fromFallback: response.fromFallback,
  };
  await appendMessage(session.sessionId, assistantMessage);

  return {
    ...response,
    sessionId: session.sessionId,
  };
}
