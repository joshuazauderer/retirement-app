import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/server/logging/loggerService';
import { validatePasswordPolicy, hashPassword } from './passwordService';
import { sendPasswordResetEmail } from '@/server/email/emailSender';

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_EXPIRY_MINUTES = 60;

function generateResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export interface RequestResetResult {
  success: boolean; // Always true to prevent enumeration
  error?: string;
}

export async function requestPasswordReset(email: string): Promise<RequestResetResult> {
  // Always return success to prevent account enumeration
  const GENERIC_SUCCESS = { success: true as const };

  try {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, password: true, closedAt: true },
    });

    // Return generic success even if user not found (anti-enumeration)
    if (!user || user.closedAt || !user.password) {
      logger.info('Password reset requested for non-existent or OAuth account', { email: normalizedEmail });
      return GENERIC_SUCCESS;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate new token
    const { raw, hash } = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt,
      },
    });

    // Build reset URL
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password/${raw}`;

    // Send email (fire and forget — don't block on email failure for UX)
    void sendPasswordResetEmail({
      to: user.email!,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
    });

    logger.info('Password reset token created', { userId: user.id });
    return GENERIC_SUCCESS;
  } catch (error) {
    logger.error('Password reset request error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Still return generic success to prevent enumeration
    return GENERIC_SUCCESS;
  }
}

export interface ValidateResetTokenResult {
  valid: boolean;
  userId?: string;
  tokenId?: string;
  error?: string;
}

export async function validateResetToken(rawToken: string): Promise<ValidateResetTokenResult> {
  try {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const token = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hash },
      include: { user: { select: { id: true, closedAt: true } } },
    });

    if (!token) {
      return { valid: false, error: 'Invalid or expired reset link' };
    }

    if (token.usedAt) {
      return { valid: false, error: 'This reset link has already been used' };
    }

    if (token.expiresAt < new Date()) {
      return { valid: false, error: 'This reset link has expired. Please request a new one.' };
    }

    if (token.user.closedAt) {
      return { valid: false, error: 'This account has been closed' };
    }

    return { valid: true, userId: token.userId, tokenId: token.id };
  } catch (error) {
    logger.error('Reset token validation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { valid: false, error: 'An unexpected error occurred' };
  }
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export async function resetPassword(params: {
  rawToken: string;
  newPassword: string;
}): Promise<ResetPasswordResult> {
  const { rawToken, newPassword } = params;

  try {
    // Validate token
    const tokenResult = await validateResetToken(rawToken);
    if (!tokenResult.valid || !tokenResult.userId) {
      return { success: false, error: tokenResult.error };
    }

    // Validate password policy
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return { success: false, error: policy.errors[0] };
    }

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Update in transaction: set new password + invalidate token
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenResult.userId },
        data: { password: newHash, updatedAt: new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { tokenHash: hash },
        data: { usedAt: new Date() },
      }),
    ]);

    // Revoke all other pending reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: tokenResult.userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    logger.info('Password reset completed', { userId: tokenResult.userId });
    return { success: true };
  } catch (error) {
    logger.error('Password reset error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
