/**
 * billingService — Stripe checkout and portal session management.
 *
 * Creates Stripe Checkout sessions for new subscriptions.
 * Creates Stripe Customer Portal sessions for managing existing subscriptions.
 * All redirects use environment-configured URLs.
 */

import { getStripeClient } from './subscriptionService';
import { ensureStripeCustomer, getUserSubscription } from './subscriptionService';
import type { CheckoutSessionResult, BillingPortalResult, PlanType } from './types';
import { getPlanByType } from './pricingService';
import { prisma } from '@/lib/prisma';

const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

/**
 * Create a Stripe Checkout session for a new subscription.
 */
export async function createCheckoutSession(
  userId: string,
  planType: PlanType,
): Promise<CheckoutSessionResult> {
  const stripe = await getStripeClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user?.email) throw new Error('User email not found');

  const plan = getPlanByType(planType);
  if (!plan.stripePriceId) throw new Error(`No Stripe Price ID configured for plan: ${planType}`);

  const customerId = await ensureStripeCustomer(userId, user.email, user.name ?? undefined);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${APP_URL}/app/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/app/settings/billing?canceled=true`,
    subscription_data: {
      metadata: { userId, planType },
    },
    metadata: { userId, planType },
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');

  return { sessionId: session.id, url: session.url };
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 */
export async function createBillingPortalSession(userId: string): Promise<BillingPortalResult> {
  const stripe = await getStripeClient();
  const sub = await getUserSubscription(userId);

  if (!sub.stripeCustomerId) {
    throw new Error('No Stripe customer found. Please subscribe first.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${APP_URL}/app/settings/billing`,
  });

  return { url: session.url };
}
