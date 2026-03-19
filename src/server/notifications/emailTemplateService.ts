/**
 * emailTemplateService — HTML email templates for notifications.
 *
 * All templates are plain HTML strings (no heavy templating engine).
 * Inline styles used for maximum email-client compatibility.
 */

import type { DigestContent, NotificationType } from './types';

const BRAND_COLOR = '#1e40af'; // blue-800
const BG_COLOR    = '#f8fafc'; // slate-50
const CARD_BG     = '#ffffff';
const TEXT_MAIN   = '#0f172a'; // slate-900
const TEXT_MUTED  = '#64748b'; // slate-500
const DIVIDER     = '#e2e8f0'; // slate-200

// ─── Alert email ──────────────────────────────────────────────────────────────

export function buildAlertEmail(params: {
  type:           NotificationType;
  title:          string;
  body:           string;
  actionUrl:      string;
  userFirstName:  string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const { title, body, actionUrl, userFirstName, unsubscribeUrl } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_COLOR};padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:${CARD_BG};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header -->
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">RetirePlan</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:${TEXT_MUTED};font-size:14px;">Hi ${userFirstName},</p>
          <h1 style="margin:0 0 16px;color:${TEXT_MAIN};font-size:22px;font-weight:700;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 24px;color:${TEXT_MAIN};font-size:16px;line-height:1.6;">${escapeHtml(body)}</p>
          <a href="${actionUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">View Your Plan</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid ${DIVIDER};">
          <p style="margin:0;color:${TEXT_MUTED};font-size:12px;">
            You received this because you have plan risk alerts enabled.<br>
            <a href="${unsubscribeUrl}" style="color:${TEXT_MUTED};">Manage notification preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${userFirstName},\n\n${title}\n\n${body}\n\nView your plan: ${actionUrl}\n\nManage preferences: ${unsubscribeUrl}`;

  return { subject: title, html, text };
}

// ─── Digest email ─────────────────────────────────────────────────────────────

export function buildDigestEmail(content: DigestContent): { subject: string; html: string; text: string } {
  const { householdName, userFirstName, periodLabel, sections, planHealthSummary, callToActionUrl, unsubscribeUrl } = content;

  const sectionsHtml = sections
    .filter((s) => s.items.length > 0)
    .map((s) => `
      <div style="margin-bottom:24px;">
        <h2 style="margin:0 0 12px;color:${TEXT_MAIN};font-size:16px;font-weight:700;border-bottom:2px solid ${BRAND_COLOR};padding-bottom:6px;">${escapeHtml(s.heading)}</h2>
        <ul style="margin:0;padding-left:20px;">
          ${s.items.map((item) => `<li style="color:${TEXT_MAIN};font-size:14px;line-height:1.7;">${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>`)
    .join('');

  const sectionsText = sections
    .filter((s) => s.items.length > 0)
    .map((s) => `${s.heading}\n${s.items.map((i) => `  • ${i}`).join('\n')}`)
    .join('\n\n');

  const subject = `${periodLabel} Digest — ${householdName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_COLOR};padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:${CARD_BG};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header -->
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">RetirePlan</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${escapeHtml(periodLabel)}</p>
        </td></tr>
        <!-- Greeting -->
        <tr><td style="padding:32px 32px 0;">
          <p style="margin:0 0 4px;color:${TEXT_MUTED};font-size:14px;">Hi ${escapeHtml(userFirstName)},</p>
          <p style="margin:0 0 24px;color:${TEXT_MAIN};font-size:16px;">Here's your retirement plan summary for <strong>${escapeHtml(householdName)}</strong>.</p>
          <!-- Plan health banner -->
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;color:#166534;font-size:14px;">📊 ${escapeHtml(planHealthSummary)}</p>
          </div>
        </td></tr>
        <!-- Sections -->
        <tr><td style="padding:0 32px;">
          ${sectionsHtml || '<p style="color:' + TEXT_MUTED + ';font-size:14px;">No updates this period. Keep building your plan!</p>'}
        </td></tr>
        <!-- CTA -->
        <tr><td style="padding:24px 32px;">
          <a href="${callToActionUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600;">Open My Plan</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid ${DIVIDER};">
          <p style="margin:0;color:${TEXT_MUTED};font-size:12px;">
            You're receiving this ${periodLabel.toLowerCase()} digest because digest emails are enabled in your preferences.<br>
            <a href="${unsubscribeUrl}" style="color:${TEXT_MUTED};">Manage notification preferences</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${userFirstName},\n\nYour ${periodLabel} for ${householdName}\n\n${planHealthSummary}\n\n${sectionsText}\n\nOpen your plan: ${callToActionUrl}\n\nManage preferences: ${unsubscribeUrl}`;

  return { subject, html, text };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
