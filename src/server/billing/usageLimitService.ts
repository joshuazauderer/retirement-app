/**
 * usageLimitService — count-based usage limits enforcement.
 *
 * Tracks current usage counts from DB and compares against plan limits.
 * Limits: scenarios, simulations per period, collaborators.
 */

import { prisma } from '@/lib/prisma';
import { getUserPlanType } from './subscriptionService';
import type { UsageLimitResult } from './types';
import { PLAN_LIMITS } from './types';

/**
 * Check if user can create another scenario.
 */
export async function checkScenarioLimit(userId: string, householdId: string): Promise<UsageLimitResult> {
  const planType = await getUserPlanType(userId);
  const limit = PLAN_LIMITS[planType].scenarios;

  if (limit === null) return { allowed: true, current: 0, limit: null };

  const current = await prisma.scenario.count({ where: { householdId } });

  return {
    allowed: current < limit,
    current,
    limit,
    reason: current >= limit
      ? `You have reached the ${limit}-scenario limit for the ${planType} plan. Upgrade to Pro for unlimited scenarios.`
      : undefined,
  };
}

/**
 * Check if user can add more collaborators.
 */
export async function checkCollaboratorLimit(userId: string, householdId: string): Promise<UsageLimitResult> {
  const planType = await getUserPlanType(userId);
  const limit = PLAN_LIMITS[planType].collaborators;

  if (limit === null) return { allowed: true, current: 0, limit: null };

  const current = await prisma.householdMembership.count({
    where: { householdId, status: 'ACTIVE' },
  });

  return {
    allowed: current < limit,
    current,
    limit,
    reason: current >= limit
      ? `You have reached the collaborator limit (${limit}) for the ${planType} plan.`
      : undefined,
  };
}

/**
 * Get full usage summary for a user/household.
 */
export async function getUsageSummary(userId: string, householdId: string): Promise<{
  scenarios: UsageLimitResult;
  collaborators: UsageLimitResult;
  planType: string;
}> {
  const [planType, scenarios, collaborators] = await Promise.all([
    getUserPlanType(userId),
    checkScenarioLimit(userId, householdId),
    checkCollaboratorLimit(userId, householdId),
  ]);

  return { scenarios, collaborators, planType };
}
