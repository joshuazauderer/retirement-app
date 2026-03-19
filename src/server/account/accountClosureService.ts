import { prisma } from '@/lib/prisma';
import { logger } from '@/server/logging/loggerService';
import { verifyPassword } from '@/server/auth/passwordService';
import { sendAccountClosureEmail } from '@/server/email/emailSender';

const REQUIRED_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

export interface AccountClosureValidationResult {
  valid: boolean;
  error?: string;
}

export function validateClosureConfirmation(phrase: string): AccountClosureValidationResult {
  if (phrase.trim().toUpperCase() !== REQUIRED_CONFIRMATION_PHRASE) {
    return { valid: false, error: `Please type "${REQUIRED_CONFIRMATION_PHRASE}" exactly to confirm` };
  }
  return { valid: true };
}

export interface CloseAccountResult {
  success: boolean;
  error?: string;
}

export async function closeAccount(params: {
  userId: string;
  password: string;
  confirmationPhrase: string;
}): Promise<CloseAccountResult> {
  const { userId, password, confirmationPhrase } = params;

  try {
    // 1. Validate confirmation phrase
    const phraseCheck = validateClosureConfirmation(confirmationPhrase);
    if (!phraseCheck.valid) {
      return { success: false, error: phraseCheck.error };
    }

    // 2. Load user with subscription (singular — schema has UserSubscription as 1:1)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        closedAt: true,
        household: { select: { id: true } },
        subscription: {
          select: { id: true, stripeSubscriptionId: true, status: true },
        },
      },
    });

    if (!user) {
      return { success: false, error: 'Account not found' };
    }

    if (user.closedAt) {
      return { success: false, error: 'This account has already been closed' };
    }

    // 3. Verify password
    if (!user.password) {
      return {
        success: false,
        error: 'Password verification is required to close your account',
      };
    }

    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      logger.warn('Account closure failed: incorrect password', { userId });
      return { success: false, error: 'Incorrect password' };
    }

    // 4. Cancel active Stripe subscription if present
    const sub = user.subscription;
    if (sub?.stripeSubscriptionId && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status)) {
      try {
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey && !stripeSecretKey.startsWith('REPLACE_')) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const Stripe = require('stripe') as typeof import('stripe');
          const stripe = new (Stripe as unknown as new (key: string, opts: object) => {
            subscriptions: { cancel: (id: string) => Promise<unknown> };
          })(stripeSecretKey, { apiVersion: '2024-11-20.acacia' });
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
          logger.info('Stripe subscription cancelled on account closure', {
            userId,
            stripeSubscriptionId: sub.stripeSubscriptionId,
          });
        }
        // Update DB status regardless
        await prisma.userSubscription.update({
          where: { id: sub.id },
          data: { status: 'CANCELED', updatedAt: new Date() },
        });
      } catch (err) {
        logger.error('Failed to cancel Stripe subscription during account closure', {
          userId,
          subId: sub.id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue with closure even if Stripe call fails
      }
    }

    // 5. Remove collaboration memberships (user as collaborator on others' households)
    await prisma.householdMembership.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REMOVED' },
    });

    // 6. Revoke all pending invitations sent to this user's email
    if (user.email) {
      await prisma.householdInvitation.updateMany({
        where: { email: user.email, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });
    }

    // 7. Invalidate all password reset tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // 8. Mark account as closed
    await prisma.user.update({
      where: { id: userId },
      data: { closedAt: new Date() },
    });

    logger.info('Account closed successfully', { userId });

    // 9. Send closure confirmation email (non-blocking)
    if (user.email) {
      void sendAccountClosureEmail({ to: user.email, name: user.name });
    }

    return { success: true };
  } catch (error) {
    logger.error('Account closure error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again or contact support.',
    };
  }
}

export const CLOSURE_CONFIRMATION_PHRASE = REQUIRED_CONFIRMATION_PHRASE;
