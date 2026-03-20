import { describe, it, expect } from 'vitest';
import { getDashboardRecommendations } from '@/server/dashboard/dashboardRecommendationService';
import type { HealthScoreResult } from '@/server/health/types';
import type { PlanCompletionSummary } from '@/server/dashboard/types';

const baseHealthScore: HealthScoreResult = {
  householdId: 'household-1',
  totalScore: 72,
  maxScore: 100,
  tier: 'GOOD',
  tierLabel: 'Good',
  components: [],
  summary: 'Your plan is in good shape.',
  topActions: ['Consider increasing your savings rate'],
  lastComputedAt: new Date().toISOString(),
  dataAsOf: {
    hasSimulation: true,
    hasHealthcarePlan: false,
    hasHousingPlan: false,
    latestSimulationDate: new Date().toISOString(),
  },
};

const baseCompletion: PlanCompletionSummary = {
  percentage: 80,
  items: [],
  coreDataComplete: true,
  hasRunSimulation: true,
  hasMonteCarlo: false,
  hasAnyAdvancedAnalysis: false,
};

describe('getDashboardRecommendations', () => {
  it('returns complete-profile action first when coreDataComplete is false', () => {
    const completion: PlanCompletionSummary = {
      ...baseCompletion,
      coreDataComplete: false,
      hasRunSimulation: false,
    };

    const actions = getDashboardRecommendations(baseHealthScore, completion, 'FREE');

    expect(actions[0].id).toBe('complete-profile');
    expect(actions[0].category).toBe('setup');
  });

  it('returns run-simulation action when data is complete but no simulation exists', () => {
    const completion: PlanCompletionSummary = {
      ...baseCompletion,
      coreDataComplete: true,
      hasRunSimulation: false,
    };

    const actions = getDashboardRecommendations(baseHealthScore, completion, 'FREE');

    expect(actions.some(a => a.id === 'run-simulation')).toBe(true);
    const simAction = actions.find(a => a.id === 'run-simulation')!;
    expect(simAction.category).toBe('analysis');
    expect(simAction.ctaHref).toBe('/app/simulations');
  });

  it('returns run-monte-carlo action when simulation exists and no MC, planType is PRO', () => {
    const completion: PlanCompletionSummary = {
      ...baseCompletion,
      hasRunSimulation: true,
      hasMonteCarlo: false,
    };

    const actions = getDashboardRecommendations(baseHealthScore, completion, 'PRO');

    expect(actions.some(a => a.id === 'run-monte-carlo')).toBe(true);
    const mcAction = actions.find(a => a.id === 'run-monte-carlo')!;
    expect(mcAction.category).toBe('analysis');
    expect(mcAction.ctaHref).toBe('/app/monte-carlo');
  });

  it('returns upgrade-monte-carlo action when planType is FREE and no MC', () => {
    const completion: PlanCompletionSummary = {
      ...baseCompletion,
      hasRunSimulation: true,
      hasMonteCarlo: false,
    };

    const actions = getDashboardRecommendations(baseHealthScore, completion, 'FREE');

    expect(actions.some(a => a.id === 'upgrade-monte-carlo')).toBe(true);
    const upgradeAction = actions.find(a => a.id === 'upgrade-monte-carlo')!;
    expect(upgradeAction.category).toBe('upgrade');
    expect(upgradeAction.ctaHref).toBe('/app/settings/billing');
  });

  it('does not include upgrade or run-monte-carlo when MC is already run', () => {
    const completion: PlanCompletionSummary = {
      ...baseCompletion,
      hasRunSimulation: true,
      hasMonteCarlo: true,
      hasAnyAdvancedAnalysis: true,
    };

    const actions = getDashboardRecommendations(baseHealthScore, completion, 'ADVISOR');

    expect(actions.some(a => a.id === 'upgrade-monte-carlo')).toBe(false);
    expect(actions.some(a => a.id === 'run-monte-carlo')).toBe(false);
  });

  it('returns at most 4 actions', () => {
    const completion: PlanCompletionSummary = {
      ...baseCompletion,
      coreDataComplete: false,
      hasRunSimulation: false,
      hasMonteCarlo: false,
      hasAnyAdvancedAnalysis: false,
    };

    const healthScoreWithActions: HealthScoreResult = {
      ...baseHealthScore,
      topActions: ['Increase your savings', 'Reduce your debt', 'Review healthcare planning'],
    };

    const actions = getDashboardRecommendations(healthScoreWithActions, completion, 'PRO');

    expect(actions.length).toBeLessThanOrEqual(4);
  });

  it('does not include complete-profile when coreDataComplete is true', () => {
    const actions = getDashboardRecommendations(baseHealthScore, baseCompletion, 'FREE');

    expect(actions.some(a => a.id === 'complete-profile')).toBe(false);
  });

  it('includes social security recommendation when simulation exists but no advanced analysis', () => {
    const completion: PlanCompletionSummary = {
      ...baseCompletion,
      hasRunSimulation: true,
      hasMonteCarlo: true,
      hasAnyAdvancedAnalysis: false,
    };

    const healthScoreNoActions: HealthScoreResult = { ...baseHealthScore, topActions: [] };

    const actions = getDashboardRecommendations(healthScoreNoActions, completion, 'PRO');

    expect(actions.some(a => a.id === 'review-social-security')).toBe(true);
  });
});
