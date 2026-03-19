/**
 * Phase 17 — Billing + Subscriptions + Pricing + Monetization Layer
 *
 * DESIGN PRINCIPLES:
 * - Billing logic is isolated from business logic
 * - Feature gates are centralized and server-side enforced
 * - Stripe is the payment provider — all financial data stays in Stripe
 * - Our DB stores only subscription state, not payment details
 *
 * LIMITATIONS (v1):
 * - Annual billing not supported yet (monthly only)
 * - No prorated plan changes via API (use Stripe Customer Portal)
 * - No team/advisor-specific billing tier yet
 * - Usage metering is count-based, not Stripe metered billing
 */

export type PlanType = 'FREE' | 'PRO' | 'ADVISOR';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'INCOMPLETE'
  | 'PAUSED'
  | 'FREE';  // No Stripe subscription — on free tier

export type FeatureName =
  | 'monte_carlo'
  | 'ai_insights'
  | 'ai_copilot'
  | 'advanced_scenarios'
  | 'tax_planning'
  | 'healthcare_planning'
  | 'housing_planning'
  | 'reports_export'
  | 'csv_export'
  | 'collaboration'
  | 'advisor_access'
  | 'unlimited_simulations'
  | 'unlimited_scenarios';

// Features available by plan
export const PLAN_FEATURES: Record<PlanType, Set<FeatureName>> = {
  FREE: new Set<FeatureName>([
    'advanced_scenarios',         // Up to 3 scenarios
    'tax_planning',               // Basic tax analysis
  ]),
  PRO: new Set<FeatureName>([
    'monte_carlo',
    'ai_insights',
    'ai_copilot',
    'advanced_scenarios',
    'tax_planning',
    'healthcare_planning',
    'housing_planning',
    'reports_export',
    'csv_export',
    'collaboration',
    'unlimited_simulations',
    'unlimited_scenarios',
  ]),
  ADVISOR: new Set<FeatureName>([
    'monte_carlo',
    'ai_insights',
    'ai_copilot',
    'advanced_scenarios',
    'tax_planning',
    'healthcare_planning',
    'housing_planning',
    'reports_export',
    'csv_export',
    'collaboration',
    'advisor_access',
    'unlimited_simulations',
    'unlimited_scenarios',
  ]),
};

// Usage limits by plan (null = unlimited)
export const PLAN_LIMITS: Record<PlanType, { scenarios: number | null; simulations: number | null; collaborators: number | null }> = {
  FREE: { scenarios: 3, simulations: 5, collaborators: 0 },
  PRO: { scenarios: null, simulations: null, collaborators: 3 },
  ADVISOR: { scenarios: null, simulations: null, collaborators: 10 },
};

export interface PlanDefinition {
  planType: PlanType;
  displayName: string;
  monthlyPriceCents: number;     // 0 for free
  stripePriceId: string;         // From env var, not hardcoded
  description: string;
  features: FeatureName[];
  highlighted?: boolean;         // Show as recommended
}

export interface UserSubscription {
  id: string;
  userId: string;
  householdId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;     // ISO timestamp
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;               // Why denied (for UI messaging)
  upgradeRequired: boolean;
  requiredPlan?: PlanType;
}

export interface UsageLimitResult {
  allowed: boolean;
  current: number;
  limit: number | null;          // null = unlimited
  reason?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

export interface BillingPortalResult {
  url: string;
}

export interface SubscriptionUpdateEvent {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}
