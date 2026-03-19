import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/server/logging/loggerService';

const BCRYPT_ROUNDS = 12;

// Password policy
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_POLICY_REGEX = {
  hasUppercase: /[A-Z]/,
  hasNumber: /[0-9]/,
};

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
  if (!PASSWORD_POLICY_REGEX.hasUppercase.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!PASSWORD_POLICY_REGEX.hasNumber.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

export async function changePassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResult> {
  const { userId, currentPassword, newPassword } = params;

  try {
    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, email: true, closedAt: true },
    });

    if (!user || user.closedAt) {
      return { success: false, error: 'Account not found or has been closed' };
    }

    if (!user.password) {
      return { success: false, error: 'Password-based login is not available for this account' };
    }

    // Verify current password
    const currentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!currentPasswordValid) {
      logger.warn('Password change failed: incorrect current password', { userId });
      return { success: false, error: 'Current password is incorrect' };
    }

    // Validate new password policy
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return { success: false, error: policy.errors[0] };
    }

    // Prevent reuse of same password
    const samePassword = await verifyPassword(newPassword, user.password);
    if (samePassword) {
      return { success: false, error: 'New password must be different from your current password' };
    }

    // Hash and update
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: newHash, updatedAt: new Date() },
    });

    logger.info('Password changed successfully', { userId });
    return { success: true };
  } catch (error) {
    logger.error('Password change error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'An unexpected error occurred' };
  }
}
