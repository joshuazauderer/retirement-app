/**
 * accessAuditService — lightweight activity/audit logging for collaboration events.
 *
 * Records collaboration-relevant actions with actor attribution.
 * All writes are non-fatal (audit failure should never block main operations).
 */

import { prisma } from '@/lib/prisma';
import type { CollaborationAction, CollaborationActivityEntry } from './types';

/**
 * Record a collaboration activity event.
 * Non-fatal: errors are swallowed so audit failures don't break main flows.
 */
export async function recordActivity(
  householdId: string,
  actorUserId: string,
  action: CollaborationAction,
  options?: {
    targetUserId?: string;
    targetEmail?: string;
    details?: string;
  },
): Promise<void> {
  try {
    await prisma.collaborationActivity.create({
      data: {
        householdId,
        actorUserId,
        action,
        targetUserId: options?.targetUserId ?? null,
        targetEmail: options?.targetEmail ?? null,
        details: options?.details ?? null,
      },
    });
  } catch {
    // Non-fatal — audit logging should never block the main operation
  }
}

/**
 * List recent activity for a household.
 */
export async function listHouseholdActivity(
  householdId: string,
  limit = 50,
): Promise<CollaborationActivityEntry[]> {
  const activities = await prisma.collaborationActivity.findMany({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { email: true } } },
  });

  return activities.map((a) => ({
    id: a.id,
    householdId: a.householdId,
    actorUserId: a.actorUserId,
    actorEmail: a.actor?.email ?? undefined,
    action: a.action as CollaborationAction,
    targetUserId: a.targetUserId ?? undefined,
    targetEmail: a.targetEmail ?? undefined,
    details: a.details ?? undefined,
    createdAt: a.createdAt.toISOString(),
  }));
}
