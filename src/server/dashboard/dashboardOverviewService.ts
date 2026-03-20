import { prisma } from '@/lib/prisma';
import { computeHealthScore } from '@/server/health/healthScoreService';
import { getUserPlanType } from '@/server/billing/subscriptionService';
import { getDashboardCompletion } from './dashboardCompletionService';
import { getDashboardRecommendations } from './dashboardRecommendationService';
import { getDashboardDataFreshness } from './dashboardDataFreshnessService';
import { getDashboardReviewCadence } from './dashboardReviewCadenceService';
import { getDashboardInsight } from './dashboardInsightService';
import { getDashboardAlerts } from './dashboardAlertsService';
import { getDashboardScenarioSnapshot } from './dashboardScenarioSnapshotService';
import { getDashboardUpgradePrompt } from './dashboardUpgradePromptService';
import { getDashboardMetrics } from './dashboardMetricsService';
import type { DashboardOverviewViewModel, PlanHealthSummary, DashboardPlanStatus } from './types';
import type { HealthScoreResult } from '@/server/health/types';

export async function getDashboardOverview(
  userId: string,
  householdId: string,
  householdName: string,
): Promise<DashboardOverviewViewModel> {
  // Fetch health score + plan type first (needed by other services)
  const [healthScore, planType] = await Promise.all([
    computeHealthScore(householdId, prisma),
    getUserPlanType(userId),
  ]);

  // Now run all section services in parallel
  const [
    completion,
    dataFreshness,
    reviewCadence,
    insight,
    alerts,
    scenarios,
    metrics,
  ] = await Promise.all([
    getDashboardCompletion(householdId),
    getDashboardDataFreshness(householdId),
    getDashboardReviewCadence(userId, householdId),
    getDashboardInsight(householdId, healthScore),
    getDashboardAlerts(userId),
    getDashboardScenarioSnapshot(householdId),
    getDashboardMetrics(householdId),
  ]);

  const nextActions = getDashboardRecommendations(healthScore, completion, planType);
  const upgradePrompt = getDashboardUpgradePrompt(planType);

  const planHealth = buildPlanHealthSummary(healthScore, completion.coreDataComplete);
  const isNewUser = completion.percentage < 20;

  return {
    planHealth,
    nextActions,
    completion,
    metrics,
    scenarios,
    dataFreshness,
    reviewCadence,
    insight,
    alerts,
    upgradePrompt,
    householdName,
    isNewUser,
  };
}

function buildPlanHealthSummary(
  healthScore: HealthScoreResult,
  coreDataComplete: boolean,
): PlanHealthSummary {
  if (!coreDataComplete) {
    return {
      score: null,
      status: 'INCOMPLETE',
      statusLabel: 'Incomplete',
      explanation: 'Complete your core plan details to generate your retirement health score.',
      tier: null,
      topAction: 'Add your income, assets, and expenses to get started.',
      hasSimulation: false,
    };
  }

  const status = tierToStatus(healthScore.tier);

  return {
    score: healthScore.totalScore,
    status,
    statusLabel: statusLabels[status],
    explanation: healthScore.summary,
    tier: healthScore.tier,
    topAction: healthScore.topActions[0] ?? null,
    hasSimulation: healthScore.dataAsOf.hasSimulation,
  };
}

const statusLabels: Record<DashboardPlanStatus, string> = {
  ON_TRACK: 'On Track',
  NEEDS_ATTENTION: 'Needs Attention',
  AT_RISK: 'At Risk',
  INCOMPLETE: 'Incomplete',
};

function tierToStatus(tier: string): DashboardPlanStatus {
  if (tier === 'EXCELLENT' || tier === 'GOOD') return 'ON_TRACK';
  if (tier === 'FAIR') return 'NEEDS_ATTENTION';
  return 'AT_RISK';
}
