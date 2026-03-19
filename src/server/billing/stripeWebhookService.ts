/**
 * stripeWebhookService — Stripe webhook event processing.
 *
 * CRITICAL:
 * - Always verify webhook signatures
 * - Processing must be idempotent (Stripe retries on failure)
 * - Never return 5xx to Stripe unless you want a retry
 * - All processing errors are logged, not thrown
 *
 * Handled events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */

import { upsertSubscriptionFromStripe } from './subscriptionService';
import { mapStripeStatus, planTypeFromStripePriceId } from './pricingService';
import { logger } from '../logging/loggerService';
import type { SubscriptionUpdateEvent } from './types';

/**
 * Verify webhook signature and parse event.
 * Returns the parsed event or throws on invalid signature.
 */
export async function parseWebhookEvent(
  rawBody: string,
  signature: string,
): Promise<import('stripe').Stripe.Event> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Process a verified Stripe webhook event.
 */
export async function processWebhookEvent(event: import('stripe').Stripe.Event): Promise<{ handled: boolean }> {
  const eventType = event.type;

  logger.info('stripe.webhook', { action: eventType, requestId: event.id });

  switch (eventType) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      await handleSubscriptionUpdate(sub);
      return { handled: true };
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as import('stripe').Stripe.Subscription;
      await handleSubscriptionDeletion(sub);
      return { handled: true };
    }

    case 'invoice.payment_succeeded': {
      logger.info('stripe.payment.succeeded', {
        action: 'payment.succeeded',
        requestId: event.id,
      });
      // Subscription status is updated via subscription.updated event
      return { handled: true };
    }

    case 'invoice.payment_failed': {
      logger.warn('stripe.payment.failed', {
        action: 'payment.failed',
        requestId: event.id,
      });
      // Stripe will update subscription status to past_due automatically
      // We handle it via the subscription.updated event
      return { handled: true };
    }

    default:
      logger.info('stripe.webhook.unhandled', { action: eventType });
      return { handled: false };
  }
}

async function handleSubscriptionUpdate(sub: import('stripe').Stripe.Subscription): Promise<void> {
  const customerId = sub.customer as string;
  const subscriptionId = sub.id;
  const firstItem = sub.items.data[0];
  const priceId = firstItem?.price?.id ?? '';
  const planType = planTypeFromStripePriceId(priceId);
  const status = mapStripeStatus(sub.status);
  // In Stripe API 2026-02-25+, current_period_end moved from Subscription to SubscriptionItem
  const periodEndSeconds = (firstItem as (typeof firstItem & { current_period_end?: number }) | undefined)?.current_period_end;
  const currentPeriodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const cancelAtPeriodEnd = sub.cancel_at_period_end;

  const updateEvent: SubscriptionUpdateEvent = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    planType,
    status,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  };

  await upsertSubscriptionFromStripe(updateEvent);

  logger.info('stripe.subscription.updated', {
    action: 'subscription.updated',
    requestId: subscriptionId,
  });
}

async function handleSubscriptionDeletion(sub: import('stripe').Stripe.Subscription): Promise<void> {
  const firstItem = sub.items.data[0];
  const periodEndSeconds = (firstItem as (typeof firstItem & { current_period_end?: number }) | undefined)?.current_period_end;
  const currentPeriodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000) : new Date();

  const updateEvent: SubscriptionUpdateEvent = {
    stripeCustomerId: sub.customer as string,
    stripeSubscriptionId: sub.id,
    planType: 'FREE',
    status: 'CANCELED',
    currentPeriodEnd,
    cancelAtPeriodEnd: true,
  };

  await upsertSubscriptionFromStripe(updateEvent);
  logger.info('stripe.subscription.canceled', { action: 'subscription.canceled', requestId: sub.id });
}
