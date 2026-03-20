import type { PlanType } from '@/server/billing/types';
import type { DashboardUpgradePrompt } from './types';

export function getDashboardUpgradePrompt(planType: PlanType): DashboardUpgradePrompt {
  if (planType === 'PRO' || planType === 'ADVISOR') {
    return {
      show: false,
      planType,
      headline: '',
      body: '',
      ctaLabel: '',
      ctaHref: '',
      featuredFeatures: [],
    };
  }

  return {
    show: true,
    planType,
    headline: 'Unlock deeper planning tools',
    body: 'Run Monte Carlo simulations, get AI-guided insights, and track your plan\'s progress over time with a Pro subscription.',
    ctaLabel: 'Upgrade to Pro',
    ctaHref: '/app/settings/billing',
    featuredFeatures: [
      'Monte Carlo simulations (1,000 scenarios)',
      'AI-powered insights and recommendations',
      'Healthcare cost planning',
      'Tax strategy analysis',
      'Unlimited scenarios',
    ],
  };
}
