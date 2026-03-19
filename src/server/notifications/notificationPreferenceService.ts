/**
 * notificationPreferenceService — get and upsert per-user notification preferences.
 *
 * Preferences are lazy-created with defaults on first fetch.
 */

import { PrismaClient } from '@prisma/client';
import type { NotificationPreferenceRecord, UpdatePreferencesInput } from './types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './types';

/**
 * Get notification preferences for a user.
 * Creates default preferences if none exist yet.
 */
export async function getNotificationPreferences(
  userId: string,
  prisma: PrismaClient,
): Promise<NotificationPreferenceRecord> {
  const existing = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (existing) {
    return mapPreferenceRecord(existing);
  }

  // Create defaults
  const created = await prisma.notificationPreference.create({
    data: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    },
  });

  return mapPreferenceRecord(created);
}

/**
 * Update notification preferences. Partial update — only provided fields change.
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: UpdatePreferencesInput,
  prisma: PrismaClient,
): Promise<NotificationPreferenceRecord> {
  const result = await prisma.notificationPreference.upsert({
    where: { userId },
    update: updates,
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...updates,
    },
  });

  return mapPreferenceRecord(result);
}

/**
 * Check if a specific alert type is enabled for a user.
 */
export async function isAlertEnabled(
  userId: string,
  alertType: 'planRiskAlerts' | 'collaborationAlerts' | 'billingAlerts' | 'simulationAlerts',
  prisma: PrismaClient,
): Promise<boolean> {
  const prefs = await getNotificationPreferences(userId, prisma);
  return prefs[alertType];
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapPreferenceRecord(raw: {
  id: string;
  userId: string;
  emailDigest: boolean;
  digestFrequency: string;
  planRiskAlerts: boolean;
  collaborationAlerts: boolean;
  billingAlerts: boolean;
  simulationAlerts: boolean;
  updatedAt: Date;
}): NotificationPreferenceRecord {
  return {
    id:                  raw.id,
    userId:              raw.userId,
    emailDigest:         raw.emailDigest,
    digestFrequency:     raw.digestFrequency as NotificationPreferenceRecord['digestFrequency'],
    planRiskAlerts:      raw.planRiskAlerts,
    collaborationAlerts: raw.collaborationAlerts,
    billingAlerts:       raw.billingAlerts,
    simulationAlerts:    raw.simulationAlerts,
    updatedAt:           raw.updatedAt,
  };
}
