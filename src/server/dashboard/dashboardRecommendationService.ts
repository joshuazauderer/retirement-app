import type { HealthScoreResult } from '@/server/health/types';
import type { PlanCompletionSummary, DashboardActionItem } from './types';

export function getDashboardRecommendations(
  healthScore: HealthScoreResult,
  completion: PlanCompletionSummary,
  planType: string,
): DashboardActionItem[] {
  const actions: DashboardActionItem[] = [];

  // Priority 1: Core data setup if incomplete
  if (!completion.coreDataComplete) {
    actions.push({
      id: 'complete-profile',
      title: 'Finish setting up your plan',
      description: 'Add your income, assets, and expenses to generate your retirement health score.',
      impact: null,
      ctaLabel: 'Continue Setup',
      ctaHref: '/app/income',
      priority: 1,
      category: 'setup',
    });
  }

  // Priority 2: Run first simulation if data is there but no sim
  if (completion.coreDataComplete && !completion.hasRunSimulation) {
    actions.push({
      id: 'run-simulation',
      title: 'Run your first retirement projection',
      description: 'You have enough data to see how your retirement plan holds up over time.',
      impact: 'Unlocks your retirement health score and ending balance',
      ctaLabel: 'Run Projection',
      ctaHref: '/app/simulations',
      priority: 1,
      category: 'analysis',
    });
  }

  // Priority 3: Health score-driven actions (top action from health score)
  if (healthScore.topActions.length > 0 && completion.hasRunSimulation) {
    const topAction = healthScore.topActions[0];
    const mapped = mapHealthActionToItem(topAction, healthScore.tier);
    if (mapped) actions.push(mapped);
  }

  // Priority 4: Monte Carlo if not run
  if (completion.hasRunSimulation && !completion.hasMonteCarlo) {
    if (planType === 'PRO' || planType === 'ADVISOR') {
      actions.push({
        id: 'run-monte-carlo',
        title: 'Test your plan across 1,000 market scenarios',
        description: 'Your plan has a baseline projection, but you haven\'t tested it across many market outcomes yet.',
        impact: 'Shows probability of success across different market conditions',
        ctaLabel: 'Run Monte Carlo',
        ctaHref: '/app/monte-carlo',
        priority: 2,
        category: 'analysis',
      });
    } else {
      actions.push({
        id: 'upgrade-monte-carlo',
        title: 'See how your plan holds up in any market',
        description: 'Monte Carlo simulations test your plan across thousands of scenarios. Available with Pro.',
        impact: null,
        ctaLabel: 'Upgrade to Pro',
        ctaHref: '/app/settings/billing',
        priority: 3,
        category: 'upgrade',
      });
    }
  }

  // Priority 5: Social Security if no advanced analysis
  if (completion.hasRunSimulation && !completion.hasAnyAdvancedAnalysis) {
    actions.push({
      id: 'review-social-security',
      title: 'Optimize your Social Security timing',
      description: 'Claiming at the right age can meaningfully increase your lifetime benefits.',
      impact: 'Could add $50,000–$200,000 in lifetime benefits',
      ctaLabel: 'Review Social Security',
      ctaHref: '/app/social-security',
      priority: 3,
      category: 'optimization',
    });
  }

  // Sort by priority, deduplicate, return top 4
  return actions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
}

function mapHealthActionToItem(
  actionLabel: string,
  tier: string,
): DashboardActionItem | null {
  const lower = actionLabel.toLowerCase();

  if (lower.includes('healthcare') || lower.includes('health')) {
    return {
      id: 'healthcare-planning',
      title: 'Model your healthcare costs in retirement',
      description: actionLabel,
      impact: 'Healthcare is often the largest unplanned retirement expense',
      ctaLabel: 'Plan Healthcare Costs',
      ctaHref: '/app/healthcare-planning',
      priority: 2,
      category: 'analysis',
    };
  }

  if (lower.includes('saving') || lower.includes('contribution') || lower.includes('asset')) {
    return {
      id: 'increase-savings',
      title: 'Explore increasing your savings rate',
      description: actionLabel,
      impact: 'Small increases now can compound significantly by retirement',
      ctaLabel: 'Try a Scenario',
      ctaHref: '/app/scenarios',
      priority: 2,
      category: 'optimization',
    };
  }

  if (lower.includes('debt') || lower.includes('liabilit')) {
    return {
      id: 'reduce-debt',
      title: 'Your debt load is affecting your plan',
      description: actionLabel,
      impact: 'Reducing high-interest debt improves long-term plan health',
      ctaLabel: 'Review Liabilities',
      ctaHref: '/app/liabilities',
      priority: 2,
      category: 'optimization',
    };
  }

  if (lower.includes('expense') || lower.includes('spending') || lower.includes('withdrawal')) {
    return {
      id: 'review-expenses',
      title: 'Review your retirement spending estimate',
      description: actionLabel,
      impact: 'Adjusting spending assumptions can extend your plan by years',
      ctaLabel: 'Update Expenses',
      ctaHref: '/app/expenses',
      priority: 2,
      category: 'optimization',
    };
  }

  if (lower.includes('social security') || lower.includes('benefit')) {
    return {
      id: 'social-security',
      title: 'Review your Social Security strategy',
      description: actionLabel,
      impact: 'Timing your claim correctly can maximize lifetime benefits',
      ctaLabel: 'Review Social Security',
      ctaHref: '/app/social-security',
      priority: 2,
      category: 'optimization',
    };
  }

  // Generic fallback
  return {
    id: 'improve-plan',
    title: 'Improve your plan health',
    description: actionLabel,
    impact: null,
    ctaLabel: 'View Plan Health',
    ctaHref: '/app/plan-health',
    priority: 2,
    category: 'optimization',
  };
}
