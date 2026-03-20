import { prisma } from '@/lib/prisma';
import { getProfileCompletion } from '@/server/services/profileCompletionService';
import type { PlanCompletionSummary, PlanCompletionItem } from './types';

export async function getDashboardCompletion(householdId: string): Promise<PlanCompletionSummary> {
  const [profileCompletion, simRun, mcRun, ssRun, taxRun, withdrawalRun] = await Promise.all([
    getProfileCompletion(householdId),
    prisma.simulationRun.findFirst({ where: { householdId }, select: { id: true } }),
    prisma.monteCarloRun.findFirst({ where: { householdId }, select: { id: true } }),
    prisma.socialSecurityRun.findFirst({ where: { householdId }, select: { id: true } }),
    prisma.taxPlanningRun.findFirst({ where: { householdId }, select: { id: true } }),
    prisma.withdrawalStrategyRun.findFirst({ where: { householdId }, select: { id: true } }),
  ]);

  const dataCategories = profileCompletion.categories;
  const coreDataComplete = profileCompletion.percentage >= 60;

  const items: PlanCompletionItem[] = [
    // Data setup items from profile completion
    ...dataCategories.map(cat => ({
      key: cat.key,
      label: cat.name,
      status: cat.complete ? 'complete' as const : 'not_started' as const,
      href: getCategoryHref(cat.key),
    })),
    // Analysis items
    {
      key: 'simulation',
      label: 'Core Projection Run',
      status: simRun ? 'complete' : (coreDataComplete ? 'attention' : 'not_started'),
      href: '/app/simulations',
    },
    {
      key: 'monte_carlo',
      label: 'Monte Carlo Analysis',
      status: mcRun ? 'complete' : 'not_started',
      href: '/app/monte-carlo',
    },
    {
      key: 'social_security',
      label: 'Social Security Reviewed',
      status: ssRun ? 'complete' : 'not_started',
      href: '/app/social-security',
    },
    {
      key: 'tax_planning',
      label: 'Tax Planning Reviewed',
      status: taxRun ? 'complete' : 'not_started',
      href: '/app/tax-planning',
    },
    {
      key: 'withdrawal',
      label: 'Withdrawal Strategy Reviewed',
      status: withdrawalRun ? 'complete' : 'not_started',
      href: '/app/withdrawal-strategies',
    },
  ];

  // Recompute overall percentage including analysis items
  const totalItems = items.length;
  const completedItems = items.filter(i => i.status === 'complete').length;
  const percentage = Math.round((completedItems / totalItems) * 100);

  return {
    percentage,
    items,
    coreDataComplete,
    hasRunSimulation: !!simRun,
    hasMonteCarlo: !!mcRun,
    hasAnyAdvancedAnalysis: !!(ssRun || taxRun || withdrawalRun || mcRun),
  };
}

function getCategoryHref(key: string): string {
  const map: Record<string, string> = {
    household: '/app/household',
    income: '/app/income',
    assets: '/app/assets',
    liabilities: '/app/liabilities',
    expenses: '/app/expenses',
    benefits: '/app/benefits',
    housing: '/app/housing',
    insurance: '/app/insurance',
    assumptions: '/app/assumptions',
  };
  return map[key] ?? '/app/overview';
}
