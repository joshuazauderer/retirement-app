/**
 * inAppNotificationService — create, list, and mark in-app notifications.
 *
 * In-app notifications live in the `notifications` table.
 * Email dispatch is handled separately by notificationDispatchService.
 */

import { PrismaClient } from '@prisma/client';
import type {
  CreateNotificationInput,
  NotificationListResult,
  NotificationRecord,
} from './types';
import { NOTIFICATION_PAGE_SIZE, NOTIFICATION_TITLES } from './types';
import { logger } from '../logging/loggerService';

/**
 * Create a single in-app notification.
 */
export async function createNotification(
  input: CreateNotificationInput,
  prisma: PrismaClient,
): Promise<NotificationRecord> {
  const title = input.title || NOTIFICATION_TITLES[input.type];

  const record = await prisma.notification.create({
    data: {
      userId:      input.userId,
      householdId: input.householdId ?? null,
      type:        input.type,
      title,
      body:        input.body,
      metadataJson: (input.metadata ?? {}) as object,
      isRead:      false,
    },
  });

  logger.info('notification.created', {
    userId:      input.userId,
    householdId: input.householdId,
    action:      input.type,
  });

  return mapNotificationRecord(record);
}

/**
 * List notifications for a user (most recent first, unread prioritised).
 */
export async function listNotifications(
  userId: string,
  prisma: PrismaClient,
  options: { includeRead?: boolean } = {},
): Promise<NotificationListResult> {
  const { includeRead = true } = options;

  const where = includeRead
    ? { userId }
    : { userId, isRead: false };

  const [records, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: NOTIFICATION_PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    notifications: records.map(mapNotificationRecord),
    unreadCount,
    total: records.length,
  };
}

/**
 * Mark a single notification as read.
 * Returns null if not found or doesn't belong to the user.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
  prisma: PrismaClient,
): Promise<NotificationRecord | null> {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!existing) return null;
  if (existing.isRead) return mapNotificationRecord(existing);

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data:  { isRead: true, readAt: new Date() },
  });

  return mapNotificationRecord(updated);
}

/**
 * Mark all unread notifications for a user as read.
 * Returns the number of notifications updated.
 */
export async function markAllNotificationsRead(
  userId: string,
  prisma: PrismaClient,
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });

  logger.info('notification.markAllRead', { userId, action: 'markAllRead' });

  return result.count;
}

/**
 * Get unread count for a user (lightweight — used by notification bell).
 */
export async function getUnreadCount(
  userId: string,
  prisma: PrismaClient,
): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

/**
 * Delete notifications older than retentionDays that have been read.
 * Called by the nightly cleanup job.
 */
export async function purgeOldNotifications(
  retentionDays: number,
  prisma: PrismaClient,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.notification.deleteMany({
    where: {
      isRead:    true,
      createdAt: { lt: cutoff },
    },
  });

  logger.info('notification.purge', { action: 'purge', durationMs: result.count });
  return result.count;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapNotificationRecord(raw: {
  id: string;
  userId: string;
  householdId: string | null;
  type: string;
  title: string;
  body: string;
  metadataJson: unknown;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRecord {
  return {
    id:          raw.id,
    userId:      raw.userId,
    householdId: raw.householdId,
    type:        raw.type as NotificationRecord['type'],
    title:       raw.title,
    body:        raw.body,
    metadata:    (raw.metadataJson as Record<string, unknown>) ?? {},
    isRead:      raw.isRead,
    readAt:      raw.readAt,
    createdAt:   raw.createdAt,
  };
}
