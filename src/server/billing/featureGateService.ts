/**
 * featureGateService — server-side feature access enforcement.
 *
 * CRITICAL: All feature checks are server-side.
 * Never rely on client state for feature gating.
 *
 * Usage in API routes:
 *   const gate = await checkFeatureGate(userId, 'monte_carlo');
 *   if (!gate.allowed) return NextResponse.json({ error: gate.reason, upgradeRequired: true }, { status: 402 });
 */

import { getUserPlanType } from './subscriptionService';
import type { FeatureName, FeatureGateResult, PlanType } from './types';
import { PLAN_FEATURES } from './types';

/**
 * Check if a user can use a specific feature.
 */
export async function checkFeatureGate(
  userId: string,
  featureName: FeatureName,
): Promise<FeatureGateResult> {
  const planType = await getUserPlanType(userId);
  return checkFeatureGateForPlan(planType, featureName);
}

/**
 * Pure synchronous check for a plan type (no DB call needed).
 */
export function checkFeatureGateForPlan(
  planType: PlanType,
  featureName: FeatureName,
): FeatureGateResult {
  const allowed = PLAN_FEATURES[planType].has(featureName);

  if (allowed) {
    return { allowed: true, upgradeRequired: false };
  }

  // Find the minimum plan that allows this feature
  const requiredPlan = findMinimumPlan(featureName);

  return {
    allowed: false,
    upgradeRequired: true,
    requiredPlan,
    reason: requiredPlan
      ? `This feature requires the ${requiredPlan} plan. Upgrade to unlock ${featureName.replace(/_/g, ' ')}.`
      : `This feature is not available on the current plan.`,
  };
}

/**
 * Find the minimum plan that includes a feature.
 */
function findMinimumPlan(featureName: FeatureName): PlanType | undefined {
  const planOrder: PlanType[] = ['FREE', 'PRO', 'ADVISOR'];
  for (const plan of planOrder) {
    if (PLAN_FEATURES[plan].has(featureName)) return plan;
  }
  return undefined;
}

/**
 * Check multiple features at once.
 */
export async function checkMultipleFeatures(
  userId: string,
  features: FeatureName[],
): Promise<Record<FeatureName, FeatureGateResult>> {
  const planType = await getUserPlanType(userId);
  const result = {} as Record<FeatureName, FeatureGateResult>;
  for (const feature of features) {
    result[feature] = checkFeatureGateForPlan(planType, feature);
  }
  return result;
}

/**
 * Require a feature or throw. Used in API route middleware.
 */
export async function requireFeature(userId: string, featureName: FeatureName): Promise<void> {
  const gate = await checkFeatureGate(userId, featureName);
  if (!gate.allowed) {
    const err = new Error('FEATURE_GATED');
    (err as NodeJS.ErrnoException).code = 'PAYMENT_REQUIRED';
    throw err;
  }
}
