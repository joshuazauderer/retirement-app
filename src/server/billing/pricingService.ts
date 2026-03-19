/**
 * pricingService — centralized plan definitions.
 *
 * Stripe Price IDs come from environment variables.
 * Never hardcode price IDs or amounts — Stripe is the source of truth for prices.
 */

import type { PlanDefinition, PlanType } from './types';
import { PLAN_FEATURES } from './types';

function getStripePriceId(planType: PlanType): string {
  switch (planType) {
    case 'PRO':
      return process.env.STRIPE_PRO_PRICE_ID ?? '';
    case 'ADVISOR':
      return process.env.STRIPE_ADVISOR_PRICE_ID ?? '';
    default:
      return '';
  }
}

export function getPlanDefinitions(): PlanDefinition[] {
  return [
    {
      planType: 'FREE',
      displayName: 'Free',
      monthlyPriceCents: 0,
      stripePriceId: '',
      description: 'Basic retirement planning tools to get started.',
      features: ['advanced_scenarios', 'tax_planning'],
    },
    {
      planType: 'PRO',
      displayName: 'Pro',
      monthlyPriceCents: 2900,  // $29/month — override via Stripe dashboard
      stripePriceId: getStripePriceId('PRO'),
      description: 'Full access to all planning, simulation, AI, and reporting tools.',
      features: Array.from(PLAN_FEATURES.PRO),
      highlighted: true,
    },
    {
      planType: 'ADVISOR',
      displayName: 'Advisor',
      monthlyPriceCents: 9900,  // $99/month
      stripePriceId: getStripePriceId('ADVISOR'),
      description: 'Everything in Pro plus advisor access controls and multi-household support.',
      features: Array.from(PLAN_FEATURES.ADVISOR),
    },
  ];
}

export function getPlanByType(planType: PlanType): PlanDefinition {
  const plans = getPlanDefinitions();
  return plans.find((p) => p.planType === planType) ?? plans[0]!;
}

/**
 * Map a Stripe Price ID to a plan type.
 * Used in webhook handling.
 */
export function planTypeFromStripePriceId(priceId: string): PlanType {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO';
  if (priceId === process.env.STRIPE_ADVISOR_PRICE_ID) return 'ADVISOR';
  return 'FREE';
}

/**
 * Map a Stripe subscription status to our SubscriptionStatus type.
 */
export function mapStripeStatus(stripeStatus: string): import('./types').SubscriptionStatus {
  const map: Record<string, import('./types').SubscriptionStatus> = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'CANCELED',
    paused: 'PAUSED',
    unpaid: 'PAST_DUE',
  };
  return map[stripeStatus] ?? 'CANCELED';
}
