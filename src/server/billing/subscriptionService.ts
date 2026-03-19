/**
 * subscriptionService — subscription record management.
 *
 * Our DB stores the subscription state synced from Stripe webhooks.
 * Stripe is always the source of truth for payment/billing state.
 */

import { prisma } from '@/lib/prisma';
import type { UserSubscription, PlanType, SubscriptionStatus, SubscriptionUpdateEvent } from './types';

/**
 * Get the current subscription for a user.
 * Returns a FREE subscription record if none exists.
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    return {
      id: `free-${userId}`,
      userId,
      planType: 'FREE',
      status: 'FREE',
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: sub.id,
    userId: sub.userId,
    householdId: sub.householdId ?? undefined,
    stripeCustomerId: sub.stripeCustomerId ?? undefined,
    stripeSubscriptionId: sub.stripeSubscriptionId ?? undefined,
    planType: sub.planType as PlanType,
    status: sub.status as SubscriptionStatus,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? undefined,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

/**
 * Get plan type for a user (fast — most common check).
 */
export async function getUserPlanType(userId: string): Promise<PlanType> {
  const sub = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { planType: true, status: true },
  });

  if (!sub) return 'FREE';
  // PAST_DUE and INCOMPLETE still get access in grace period (Stripe will cancel if unpaid)
  if (sub.status === 'CANCELED' || sub.status === 'FREE') return 'FREE';
  return sub.planType as PlanType;
}

/**
 * Upsert subscription from Stripe webhook data (idempotent).
 */
export async function upsertSubscriptionFromStripe(event: SubscriptionUpdateEvent): Promise<void> {
  // Find user by Stripe customer ID
  const existing = await prisma.userSubscription.findFirst({
    where: { stripeCustomerId: event.stripeCustomerId },
    select: { userId: true },
  });

  if (!existing) {
    // Cannot upsert without knowing the userId
    // This happens if the customer was created outside our system
    console.error('[billing] Received subscription event for unknown Stripe customer:', event.stripeCustomerId);
    return;
  }

  await prisma.userSubscription.upsert({
    where: { userId: existing.userId },
    create: {
      userId: existing.userId,
      stripeCustomerId: event.stripeCustomerId,
      stripeSubscriptionId: event.stripeSubscriptionId,
      planType: event.planType,
      status: event.status,
      currentPeriodEnd: event.currentPeriodEnd,
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    },
    update: {
      stripeSubscriptionId: event.stripeSubscriptionId,
      planType: event.planType,
      status: event.status,
      currentPeriodEnd: event.currentPeriodEnd,
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    },
  });
}

/**
 * Create or retrieve Stripe customer ID for a user.
 * Stores the Stripe customer ID in our DB.
 */
export async function ensureStripeCustomer(
  userId: string,
  email: string,
  name?: string,
): Promise<string> {
  // Check if we already have a customer ID
  const existing = await prisma.userSubscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  // Create Stripe customer
  const stripe = await getStripeClient();
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  });

  // Store in DB
  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customer.id,
      planType: 'FREE',
      status: 'FREE',
      cancelAtPeriodEnd: false,
    },
    update: {
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

/**
 * Get Stripe client (lazy import to avoid build issues when key not set).
 */
async function getStripeClient() {
  const Stripe = (await import('stripe')).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2026-02-25.clover' });
}

export { getStripeClient };
