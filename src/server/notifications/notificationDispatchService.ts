/**
 * notificationDispatchService — orchestrate notification creation + email delivery.
 *
 * This is the main entry point for all notification workflows.
 * It coordinates:
 *   1. In-app notification creation (always)
 *   2. Email delivery (if user has email enabled + correct preference)
 *   3. Digest assembly and delivery
 *   4. Alert threshold checking
 */

import { PrismaClient } from '@prisma/client';
import type { CreateNotificationInput, NotificationType } from './types';
import { createNotification }            from './inAppNotificationService';
import { getNotificationPreferences }    from './notificationPreferenceService';
import { assembleDigest }                from './digestAssemblyService';
import { buildAlertEmail, buildDigestEmail } from './emailTemplateService';
import { sendEmail, getAppBaseUrl, buildUnsubscribeUrl } from './emailSendService';
import { logger } from '../logging/loggerService';

// ─── Public dispatch functions ────────────────────────────────────────────────

/**
 * Dispatch a plan risk or system alert notification.
 * Always creates in-app; emails if user has alerting enabled.
 */
export async function dispatchAlert(params: {
  input:         CreateNotificationInput;
  userEmail:     string;
  userFirstName: string;
  prisma:        PrismaClient;
}): Promise<void> {
  const { input, userEmail, userFirstName, prisma } = params;

  // Always create in-app notification
  await createNotification(input, prisma);

  // Check if email alerts are enabled
  const prefs = await getNotificationPreferences(input.userId, prisma);
  if (!prefs.emailDigest) return;

  const alertCategory = resolveAlertCategory(input.type);
  if (alertCategory === 'planRisk'    && !prefs.planRiskAlerts)      return;
  if (alertCategory === 'collab'      && !prefs.collaborationAlerts)  return;
  if (alertCategory === 'billing'     && !prefs.billingAlerts)        return;
  if (alertCategory === 'simulation'  && !prefs.simulationAlerts)     return;

  const baseUrl      = getAppBaseUrl();
  const template     = buildAlertEmail({
    type:           input.type,
    title:          input.title,
    body:           input.body,
    actionUrl:      `${baseUrl}/app/notifications`,
    userFirstName,
    unsubscribeUrl: buildUnsubscribeUrl(input.userId),
  });

  await sendEmail({ to: userEmail, ...template });
}

/**
 * Dispatch a collaboration notification (invite, accepted, removed).
 */
export async function dispatchCollaborationNotification(params: {
  userId:        string;
  householdId:   string;
  type:          'COLLABORATION_INVITE' | 'COLLABORATION_ACCEPTED' | 'MEMBER_REMOVED';
  title:         string;
  body:          string;
  userEmail:     string;
  userFirstName: string;
  metadata?:     Record<string, unknown>;
  prisma:        PrismaClient;
}): Promise<void> {
  const { userId, householdId, type, title, body, userEmail, userFirstName, metadata, prisma } = params;

  await dispatchAlert({
    input:  { userId, householdId, type, title, body, metadata, channel: 'BOTH' },
    userEmail,
    userFirstName,
    prisma,
  });
}

/**
 * Dispatch a billing notification (payment failed, cancelled, etc.)
 */
export async function dispatchBillingNotification(params: {
  userId:        string;
  type:          'BILLING_PAYMENT_FAILED' | 'BILLING_SUBSCRIPTION_CANCELLED' | 'BILLING_TRIAL_ENDING';
  title:         string;
  body:          string;
  userEmail:     string;
  userFirstName: string;
  prisma:        PrismaClient;
}): Promise<void> {
  const { userId, type, title, body, userEmail, userFirstName, prisma } = params;

  await dispatchAlert({
    input:  { userId, type, title, body, channel: 'BOTH' },
    userEmail,
    userFirstName,
    prisma,
  });
}

/**
 * Send the weekly/monthly digest for a single user + household.
 * Called by the scheduled digest job.
 */
export async function dispatchDigest(params: {
  userId:       string;
  householdId:  string;
  userEmail:    string;
  userFirstName: string;
  frequency:    'WEEKLY' | 'MONTHLY';
  prisma:       PrismaClient;
}): Promise<boolean> {
  const { userId, householdId, userEmail, userFirstName, frequency, prisma } = params;

  // Check preferences
  const prefs = await getNotificationPreferences(userId, prisma);
  if (!prefs.emailDigest || prefs.digestFrequency === 'NEVER') {
    return false;
  }
  if (prefs.digestFrequency !== frequency) return false;

  // Assemble digest content
  const content = await assembleDigest({
    userId,
    householdId,
    userEmail,
    userFirstName,
    frequency,
    prisma,
  });

  if (!content) {
    logger.info('notification.digestSkipped', {
      userId,
      householdId,
      action: 'digest.skipped.noData',
    });
    return false;
  }

  // Build email
  const template = buildDigestEmail(content);

  // Send email
  const result = await sendEmail({ to: userEmail, ...template });

  // Create in-app notification for digest (lightweight summary)
  const notifType: NotificationType = frequency === 'WEEKLY' ? 'WEEKLY_DIGEST' : 'MONTHLY_DIGEST';
  await createNotification(
    {
      userId,
      householdId,
      type:  notifType,
      title: template.subject,
      body:  content.planHealthSummary,
    },
    prisma,
  );

  logger.info('notification.digestSent', {
    userId,
    householdId,
    action: `digest.${frequency.toLowerCase()}`,
  });

  return result.success;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AlertCategory = 'planRisk' | 'collab' | 'billing' | 'simulation' | 'other';

function resolveAlertCategory(type: NotificationType): AlertCategory {
  if (type === 'PLAN_RISK_HIGH' || type === 'PLAN_RISK_CRITICAL' || type === 'PORTFOLIO_DEPLETION_ALERT') {
    return 'planRisk';
  }
  if (type === 'COLLABORATION_INVITE' || type === 'COLLABORATION_ACCEPTED' || type === 'MEMBER_REMOVED') {
    return 'collab';
  }
  if (type === 'BILLING_PAYMENT_FAILED' || type === 'BILLING_SUBSCRIPTION_CANCELLED' || type === 'BILLING_TRIAL_ENDING') {
    return 'billing';
  }
  if (type === 'SIMULATION_COMPLETE') {
    return 'simulation';
  }
  return 'other';
}
