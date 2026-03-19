import { logger } from '@/server/logging/loggerService';
import { sendEmail } from '@/server/notifications/emailSendService';

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<SendEmailResult> {
  try {
    const { to, resetUrl, expiresInMinutes } = params;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset your RetirePlan password</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b;">
  <div style="margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 4px;">RetirePlan</h1>
  </div>
  <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px;">Reset your password</h2>
  <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
    We received a request to reset the password for your RetirePlan account. Click the button below to choose a new password.
  </p>
  <a href="${resetUrl}" style="display: inline-block; background: #1d4ed8; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-bottom: 24px;">
    Reset Password
  </a>
  <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
    This link will expire in ${expiresInMinutes} minutes. If you didn't request a password reset, you can safely ignore this email — your password will not change.
  </p>
  <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0;">
    If the button doesn't work, copy and paste this URL into your browser:<br>
    <span style="color: #1d4ed8; word-break: break-all;">${resetUrl}</span>
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
  <p style="color: #94a3b8; font-size: 12px;">
    RetirePlan — Retirement Planning Platform<br>
    Need help? Contact us at support@retireplan.app
  </p>
</body>
</html>`;

    const text = `Reset your RetirePlan password\n\nWe received a request to reset the password for your RetirePlan account.\n\nReset your password here:\n${resetUrl}\n\nThis link expires in ${expiresInMinutes} minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\nRetirePlan — support@retireplan.app`;

    const result = await sendEmail({
      to,
      subject: 'Reset your RetirePlan password',
      html,
      text,
    });

    if (!result.success) {
      logger.error('Failed to send password reset email', { to, error: result.error });
      return { success: false, error: 'Failed to send email' };
    }

    logger.info('Password reset email sent', { to });
    return { success: true };
  } catch (error) {
    logger.error('Failed to send password reset email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendAccountClosureEmail(params: {
  to: string;
  name: string | null;
}): Promise<SendEmailResult> {
  try {
    const { to, name } = params;
    const displayName = name ?? 'there';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your RetirePlan account has been closed</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b;">
  <div style="margin-bottom: 32px;">
    <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 4px;">RetirePlan</h1>
  </div>
  <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 12px;">Account closed</h2>
  <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">Hi ${displayName},</p>
  <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
    Your RetirePlan account has been successfully closed. Your access to the platform has been removed and any active subscriptions have been cancelled.
  </p>
  <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
    We're sorry to see you go. If you change your mind, you can create a new account at any time.
  </p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
  <p style="color: #94a3b8; font-size: 12px;">
    RetirePlan — Retirement Planning Platform<br>
    Questions? Contact us at support@retireplan.app
  </p>
</body>
</html>`;

    const result = await sendEmail({
      to,
      subject: 'Your RetirePlan account has been closed',
      html,
      text: `Hi ${displayName},\n\nYour RetirePlan account has been successfully closed.\n\nIf you have questions, contact us at support@retireplan.app.\n\nRetirePlan`,
    });

    if (!result.success) {
      logger.error('Failed to send account closure email', { to, error: result.error });
      return { success: false, error: 'Failed to send email' };
    }

    logger.info('Account closure email sent', { to });
    return { success: true };
  } catch (error) {
    logger.error('Failed to send account closure email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendContactRequestEmail(params: {
  name: string;
  email: string;
  subject: string | null;
  message: string;
  submittedAt: Date;
}): Promise<SendEmailResult> {
  try {
    const { name, email, subject, message, submittedAt } = params;
    const displaySubject = subject ?? '(no subject)';
    const formattedDate = submittedAt.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'America/Chicago',
    });

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New contact request — RetirePlan</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1e293b;">
  <div style="margin-bottom: 24px;">
    <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 4px;">RetirePlan</h1>
    <p style="font-size: 13px; color: #64748b; margin: 0;">New contact form submission</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 120px; vertical-align: top;">From</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500; color: #0f172a;">${name} &lt;${email}&gt;</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; vertical-align: top;">Subject</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a;">${displaySubject}</td>
    </tr>
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; vertical-align: top;">Submitted</td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a;">${formattedDate}</td>
    </tr>
  </table>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="font-size: 13px; color: #64748b; margin: 0 0 8px; font-weight: 500;">MESSAGE</p>
    <p style="font-size: 14px; color: #1e293b; line-height: 1.7; margin: 0; white-space: pre-wrap;">${message}</p>
  </div>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="color: #94a3b8; font-size: 12px; margin: 0;">
    RetirePlan — Contact Form Notification<br>
    Reply directly to this email to respond to ${name}.
  </p>
</body>
</html>`;

    const text = `New contact request — RetirePlan\n\nFrom: ${name} <${email}>\nSubject: ${displaySubject}\nSubmitted: ${formattedDate}\n\nMessage:\n${message}`;

    const result = await sendEmail({
      to: 'joshua.zauderer@gmail.com',
      subject: `[RetirePlan Contact] ${displaySubject}`,
      html,
      text,
    });

    if (!result.success) {
      logger.error('Failed to send contact request email', { email, error: result.error });
      return { success: false, error: 'Failed to send email' };
    }

    logger.info('Contact request email sent', { from: email });
    return { success: true };
  } catch (error) {
    logger.error('Failed to send contact request email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Failed to send email' };
  }
}
