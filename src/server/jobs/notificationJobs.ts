/**
 * notificationJobs — scheduled notification job definitions.
 *
 * Uses the Phase 16 jobRunner (fire-and-forget).
 * In production, these would be triggered by a cron scheduler
 * (Coolify scheduled tasks, Vercel Cron, or external service).
 *
 * v1: Triggered via POST /api/notifications/jobs (admin/internal)
 */

import { PrismaClient } from '@prisma/client';
import { enqueueJob } from './jobRunner';
import { checkAlertThresholds } from '../notifications/alertThresholdService';
import { dispatchDigest } from '../notifications/notificationDispatchService';
import { purgeOldNotifications } from '../notifications/inAppNotificationService';
import { NOTIFICATION_RETENTION_DAYS } from '../notifications/types';
import { logger } from '../logging/loggerService';

const prisma = new PrismaClient();

/**
 * Run alert threshold checks for all households.
 * Enqueued as a background job — returns job ID immediately.
 */
export function enqueueAlertCheck(): string {
  return enqueueJob('notification.alertCheck', async () => {
    // Get all households that have at least one simulation run
    const households = await prisma.household.findMany({
      include: {
        primaryUser: { select: { id: true, email: true } },
        simulationRuns: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    let totalAlerts = 0;

    for (const hh of households) {
      if (hh.simulationRuns.length === 0) continue;
      if (!hh.primaryUser?.email) continue;

      try {
        const result = await checkAlertThresholds(hh.primaryUserId, hh.id, prisma);
        totalAlerts += result.alertsCreated;
      } catch (err) {
        logger.error('notification.alertCheck.failed', { householdId: hh.id }, err instanceof Error ? err : undefined);
      }
    }

    logger.info('notification.alertCheckComplete', { action: 'alertCheck.complete' });
    return { householdsChecked: households.length, totalAlerts };
  });
}

/**
 * Run weekly digest dispatch for all opted-in users.
 */
export function enqueueWeeklyDigest(): string {
  return enqueueJob('notification.weeklyDigest', async () => {
    return runDigestJob('WEEKLY');
  });
}

/**
 * Run monthly digest dispatch for all opted-in users.
 */
export function enqueueMonthlyDigest(): string {
  return enqueueJob('notification.monthlyDigest', async () => {
    return runDigestJob('MONTHLY');
  });
}

/**
 * Purge old read notifications.
 */
export function enqueuePurgeOldNotifications(): string {
  return enqueueJob('notification.purge', async () => {
    const purged = await purgeOldNotifications(NOTIFICATION_RETENTION_DAYS, prisma);
    return { purged };
  });
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function runDigestJob(frequency: 'WEEKLY' | 'MONTHLY'): Promise<{
  attempted: number;
  sent: number;
  skipped: number;
}> {
  // Get all users with a household + email
  const households = await prisma.household.findMany({
    include: {
      primaryUser: { select: { id: true, email: true, name: true } },
    },
  });

  let attempted = 0;
  let sent = 0;
  let skipped = 0;

  for (const hh of households) {
    if (!hh.primaryUser?.email) continue;

    const userFirstName = extractFirstName(hh.primaryUser.name ?? hh.primaryUser.email);

    attempted++;
    try {
      const dispatched = await dispatchDigest({
        userId:       hh.primaryUserId,
        householdId:  hh.id,
        userEmail:    hh.primaryUser.email,
        userFirstName,
        frequency,
        prisma,
      });

      if (dispatched) { sent++; } else { skipped++; }
    } catch (err) {
      skipped++;
      logger.error('notification.digestFailed', { householdId: hh.id }, err instanceof Error ? err : undefined);
    }
  }

  logger.info(`notification.${frequency.toLowerCase()}DigestComplete`, {
    action: `digest.${frequency.toLowerCase()}.complete`,
  });

  return { attempted, sent, skipped };
}

function extractFirstName(nameOrEmail: string): string {
  if (nameOrEmail.includes('@')) {
    return nameOrEmail.split('@')[0];
  }
  return nameOrEmail.split(' ')[0];
}
