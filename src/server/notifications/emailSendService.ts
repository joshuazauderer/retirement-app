/**
 * emailSendService — send transactional emails via Resend (or log in dev mode).
 *
 * Provider: Resend (resend.com) — modern, developer-friendly email API.
 * Fallback: In development or when RESEND_API_KEY is not set, emails are
 *           logged to console instead of sent. No build-time crash.
 *
 * Env vars required for real sending:
 *   RESEND_API_KEY          — Resend API key
 *   NOTIFICATION_FROM_EMAIL — Sender address, e.g. "RetirePlan <noreply@retireplan.app>"
 *   NEXT_PUBLIC_APP_URL     — Base URL for links in emails
 */

import type { EmailSendResult } from './types';
import { logger } from '../logging/loggerService';

const FROM_EMAIL =
  process.env.NOTIFICATION_FROM_EMAIL ?? 'RetirePlan <noreply@retireplan.app>';

/**
 * Send an email. Uses Resend if configured, otherwise dev-mode logging.
 */
export async function sendEmail(params: {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return sendDevEmail(params);
  }

  try {
    const result = await sendViaResend(apiKey, params);
    logger.info('email.sent', { action: 'email.sent' });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown send error';
    logger.warn('email.sendFailed', { action: 'email.sendFailed' });
    return { success: false, error: message };
  }
}

/**
 * Send multiple emails. Errors on individual sends are collected, not thrown.
 */
export async function sendEmails(
  emails: Array<{ to: string; subject: string; html: string; text: string }>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Sequential to avoid rate limits
  for (const email of emails) {
    const result = await sendEmail(email);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

// ─── Resend provider ──────────────────────────────────────────────────────────

async function sendViaResend(
  apiKey: string,
  params: { to: string; subject: string; html: string; text: string },
): Promise<EmailSendResult> {
  const response = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [params.to],
      subject: params.subject,
      html:    params.html,
      text:    params.text,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as { id?: string };
  return { success: true, messageId: data.id };
}

// ─── Dev mode fallback ────────────────────────────────────────────────────────

function sendDevEmail(params: {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}): EmailSendResult {
  // Log the email content for local development inspection
  logger.info('email.devMode', {
    action: 'email.devMode',
  });

  // Log to stderr for visibility in dev
  if (process.env.NODE_ENV !== 'test') {
    console.error(
      `[DEV EMAIL]\nTo: ${params.to}\nSubject: ${params.subject}\n\n${params.text}\n`,
    );
  }

  return {
    success:   true,
    messageId: `dev_${Date.now()}`,
    devMode:   true,
  };
}

/**
 * Get the base URL for generating links in emails.
 */
export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

/**
 * Build the unsubscribe URL for a user's notification preferences.
 */
export function buildUnsubscribeUrl(userId: string): string {
  // userId is included as an opaque identifier (not sensitive — preferences page requires auth)
  return `${getAppBaseUrl()}/app/settings/notifications`;
}
