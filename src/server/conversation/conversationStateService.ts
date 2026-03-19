/**
 * conversationStateService — manage conversation session state in DB.
 *
 * Sessions are stored in the ConversationSession DB table.
 * Messages are stored as JSON in the session record.
 * Sessions expire after 7 days of inactivity.
 */

import { prisma } from '@/lib/prisma';
import type { ConversationSession, ConversationMessage, ConversationContext } from './types';

const SESSION_TTL_DAYS = 7;
const MAX_MESSAGES_PER_SESSION = 50;

/**
 * Create a new conversation session.
 */
export async function createSession(
  householdId: string,
  userId: string,
  context: ConversationContext,
): Promise<ConversationSession> {
  const session = await prisma.conversationSession.create({
    data: {
      householdId,
      userId,
      messagesJson: [] as unknown as import('@prisma/client').Prisma.InputJsonValue,
      contextJson: context as unknown as import('@prisma/client').Prisma.InputJsonValue,
    },
  });

  return {
    sessionId: session.id,
    householdId: session.householdId,
    userId: session.userId,
    messages: [],
    context,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/**
 * Load an existing session.
 */
export async function loadSession(
  sessionId: string,
  userId: string,
): Promise<ConversationSession | null> {
  const session = await prisma.conversationSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) return null;

  // Check TTL
  const age = Date.now() - session.updatedAt.getTime();
  if (age > SESSION_TTL_DAYS * 24 * 60 * 60 * 1000) {
    await prisma.conversationSession.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return {
    sessionId: session.id,
    householdId: session.householdId,
    userId: session.userId,
    messages: session.messagesJson as unknown as ConversationMessage[],
    context: session.contextJson as unknown as ConversationContext,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/**
 * Append a message to a session and save.
 */
export async function appendMessage(
  sessionId: string,
  message: ConversationMessage,
): Promise<void> {
  const session = await prisma.conversationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return;

  const messages = (session.messagesJson as unknown as ConversationMessage[]) ?? [];
  messages.push(message);

  // Trim to max messages (keep last N)
  const trimmed = messages.slice(-MAX_MESSAGES_PER_SESSION);

  await prisma.conversationSession.update({
    where: { id: sessionId },
    data: { messagesJson: trimmed as unknown as import('@prisma/client').Prisma.InputJsonValue },
  });
}

/**
 * List recent sessions for a household.
 */
export async function listSessions(
  householdId: string,
  userId: string,
): Promise<Array<{ sessionId: string; createdAt: string; messageCount: number }>> {
  const sessions = await prisma.conversationSession.findMany({
    where: { householdId, userId },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  return sessions.map((s) => ({
    sessionId: s.id,
    createdAt: s.createdAt.toISOString(),
    messageCount: Array.isArray(s.messagesJson) ? (s.messagesJson as unknown[]).length : 0,
  }));
}

/**
 * Delete old sessions (cleanup utility).
 */
export async function cleanupOldSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.conversationSession.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  }).catch(() => {});
}
