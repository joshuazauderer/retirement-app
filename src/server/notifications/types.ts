/**
 * notifications/types.ts — shared types for Phase 18: Notification System.
 *
 * Design principles:
 * - In-app notifications stored in DB, readable in real time
 * - Email notifications dispatched via Resend (or logged in dev mode)
 * - Digest emails assembled from existing planning data — no re-computation
 * - Alert thresholds checked against deterministic engine outputs only
 * - User preferences respected: opt-out per type, choose digest cadence
 */

// ─── Notification type catalogue ─────────────────────────────────────────────

export type NotificationType =
  | 'PLAN_RISK_HIGH'
  | 'PLAN_RISK_CRITICAL'
  | 'SIMULATION_COMPLETE'
  | 'PORTFOLIO_DEPLETION_ALERT'
  | 'COLLABORATION_INVITE'
  | 'COLLABORATION_ACCEPTED'
  | 'MEMBER_REMOVED'
  | 'BILLING_PAYMENT_FAILED'
  | 'BILLING_SUBSCRIPTION_CANCELLED'
  | 'BILLING_TRIAL_ENDING'
  | 'WEEKLY_DIGEST'
  | 'MONTHLY_DIGEST'
  | 'SYSTEM_ANNOUNCEMENT';

export type DigestFrequency = 'WEEKLY' | 'MONTHLY' | 'NEVER';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'BOTH';

// ─── DB-backed records ────────────────────────────────────────────────────────

export interface NotificationRecord {
  id: string;
  userId: string;
  householdId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferenceRecord {
  id: string;
  userId: string;
  emailDigest: boolean;
  digestFrequency: DigestFrequency;
  planRiskAlerts: boolean;
  collaborationAlerts: boolean;
  billingAlerts: boolean;
  simulationAlerts: boolean;
  updatedAt: Date;
}

// ─── Service inputs / outputs ─────────────────────────────────────────────────

export interface CreateNotificationInput {
  userId: string;
  householdId?: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  channel?: NotificationChannel;
}

export interface UpdatePreferencesInput {
  emailDigest?: boolean;
  digestFrequency?: DigestFrequency;
  planRiskAlerts?: boolean;
  collaborationAlerts?: boolean;
  billingAlerts?: boolean;
  simulationAlerts?: boolean;
}

export interface NotificationListResult {
  notifications: NotificationRecord[];
  unreadCount: number;
  total: number;
}

// ─── Digest assembly ──────────────────────────────────────────────────────────

export interface DigestSection {
  heading: string;
  items: string[];
}

export interface DigestContent {
  householdName: string;
  userFirstName: string;
  periodLabel: string;
  sections: DigestSection[];
  planHealthSummary: string;
  callToActionUrl: string;
  unsubscribeUrl: string;
}

// ─── Alert threshold results ──────────────────────────────────────────────────

export interface AlertCheckResult {
  alertsCreated: number;
  alertTypes: NotificationType[];
  householdId: string;
}

// ─── Email send result ────────────────────────────────────────────────────────

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  devMode?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  PLAN_RISK_HIGH:                  'High Risk Detected in Your Retirement Plan',
  PLAN_RISK_CRITICAL:              'Critical Risk — Immediate Attention Required',
  SIMULATION_COMPLETE:             'Simulation Run Complete',
  PORTFOLIO_DEPLETION_ALERT:       'Portfolio Depletion Alert',
  COLLABORATION_INVITE:            "You've Been Invited to a Household Plan",
  COLLABORATION_ACCEPTED:          'Invitation Accepted',
  MEMBER_REMOVED:                  'Access Removed from Household Plan',
  BILLING_PAYMENT_FAILED:          'Payment Failed — Action Required',
  BILLING_SUBSCRIPTION_CANCELLED:  'Subscription Cancelled',
  BILLING_TRIAL_ENDING:            'Trial Ending Soon',
  WEEKLY_DIGEST:                   'Your Weekly Retirement Plan Digest',
  MONTHLY_DIGEST:                  'Your Monthly Retirement Plan Digest',
  SYSTEM_ANNOUNCEMENT:             'Announcement from RetirePlan',
};

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  NotificationPreferenceRecord,
  'id' | 'userId' | 'updatedAt'
> = {
  emailDigest:          true,
  digestFrequency:      'WEEKLY',
  planRiskAlerts:       true,
  collaborationAlerts:  true,
  billingAlerts:        true,
  simulationAlerts:     false,
};

/** Max in-app notifications returned per request */
export const NOTIFICATION_PAGE_SIZE = 50;

/** How long to keep read notifications (days) */
export const NOTIFICATION_RETENTION_DAYS = 90;
