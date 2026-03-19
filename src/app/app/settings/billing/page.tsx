import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserSubscription } from '@/server/billing/subscriptionService';
import { getPlanDefinitions } from '@/server/billing/pricingService';
import { getUsageSummary } from '@/server/billing/usageLimitService';
import { prisma } from '@/lib/prisma';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { UpgradeButton } from './UpgradeButton';
import type { PlanType, FeatureName } from '@/server/billing/types';
import { PLAN_FEATURES } from '@/server/billing/types';

interface BillingPageProps {
  searchParams: { success?: string; canceled?: string };
}

const FEATURE_LABELS: Record<FeatureName, string> = {
  monte_carlo: 'Monte Carlo Simulation',
  ai_insights: 'AI Insights',
  ai_copilot: 'AI Copilot',
  advanced_scenarios: 'Advanced Scenarios',
  tax_planning: 'Tax Planning',
  healthcare_planning: 'Healthcare Planning',
  housing_planning: 'Housing Planning',
  reports_export: 'Reports Export',
  csv_export: 'CSV Export',
  collaboration: 'Collaboration',
  advisor_access: 'Advisor Access',
  unlimited_simulations: 'Unlimited Simulations',
  unlimited_scenarios: 'Unlimited Scenarios',
};

const DISPLAY_FEATURES: FeatureName[] = [
  'advanced_scenarios',
  'tax_planning',
  'monte_carlo',
  'ai_insights',
  'ai_copilot',
  'healthcare_planning',
  'housing_planning',
  'reports_export',
  'csv_export',
  'collaboration',
  'unlimited_simulations',
  'unlimited_scenarios',
  'advisor_access',
];

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  // Get household for usage summary
  const household = await prisma.household.findFirst({
    where: { primaryUserId: userId },
    select: { id: true },
  });

  const [subscription, plans, usage] = await Promise.all([
    getUserSubscription(userId),
    Promise.resolve(getPlanDefinitions()),
    household
      ? getUsageSummary(userId, household.id)
      : Promise.resolve(null),
  ]);

  const statusLabel: Record<string, string> = {
    ACTIVE: 'Active',
    TRIALING: 'Trial',
    PAST_DUE: 'Past Due',
    CANCELED: 'Canceled',
    INCOMPLETE: 'Incomplete',
    PAUSED: 'Paused',
    FREE: 'Free',
  };

  const isCurrentPlan = (planType: PlanType) => subscription.planType === planType;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Toast messages */}
      {searchParams.success === 'true' && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-green-800 text-sm font-medium">
          Subscription activated successfully. Welcome to {subscription.planType === 'FREE' ? 'Pro' : subscription.planType}!
        </div>
      )}
      {searchParams.canceled === 'true' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
          Checkout was canceled. Your plan has not changed.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing & Subscription</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your plan, billing details, and feature access.
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Current Plan</h2>
          <PlanBadge planType={subscription.planType} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Status</span>
            <p className="font-medium text-slate-900 mt-0.5">
              {statusLabel[subscription.status] ?? subscription.status}
              {subscription.status === 'PAST_DUE' && (
                <span className="ml-2 text-xs text-red-600 font-normal">— Payment required</span>
              )}
            </p>
          </div>

          {subscription.currentPeriodEnd && (
            <div>
              <span className="text-slate-500">
                {subscription.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
              </span>
              <p className="font-medium text-slate-900 mt-0.5">
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {subscription.cancelAtPeriodEnd && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Your subscription will not renew. Access continues until{' '}
            {subscription.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
              : 'the end of the billing period'}.
          </div>
        )}

        {subscription.stripeCustomerId && (
          <form action="/api/billing/portal" method="POST">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Manage Subscription
            </button>
          </form>
        )}
      </div>

      {/* Plan Comparison */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-left text-slate-500 font-medium w-1/2">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.planType} className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      {plan.highlighted && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                          Recommended
                        </span>
                      )}
                      <span className="font-semibold text-slate-900">{plan.displayName}</span>
                      <span className="text-slate-600">
                        {plan.monthlyPriceCents === 0
                          ? 'Free'
                          : `$${(plan.monthlyPriceCents / 100).toFixed(0)}/mo`}
                      </span>
                      {isCurrentPlan(plan.planType) ? (
                        <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                          Current Plan
                        </span>
                      ) : plan.planType !== 'FREE' ? (
                        <UpgradeButton planType={plan.planType} />
                      ) : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISPLAY_FEATURES.map((feature, idx) => (
                <tr key={feature} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-6 py-3 text-slate-700">{FEATURE_LABELS[feature]}</td>
                  {plans.map((plan) => (
                    <td key={plan.planType} className="px-6 py-3 text-center">
                      {PLAN_FEATURES[plan.planType].has(feature) ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Summary */}
      {usage && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Usage</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Scenarios</span>
                <span className="font-medium text-slate-900">
                  {usage.scenarios.current}
                  {usage.scenarios.limit !== null ? ` / ${usage.scenarios.limit}` : ' / Unlimited'}
                </span>
              </div>
              {usage.scenarios.limit !== null && (
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, (usage.scenarios.current / usage.scenarios.limit) * 100)}%` }}
                  />
                </div>
              )}
              {usage.scenarios.reason && (
                <p className="text-xs text-amber-700 mt-1">{usage.scenarios.reason}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Collaborators</span>
                <span className="font-medium text-slate-900">
                  {usage.collaborators.current}
                  {usage.collaborators.limit !== null ? ` / ${usage.collaborators.limit}` : ' / Unlimited'}
                </span>
              </div>
              {usage.collaborators.limit !== null && (
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, (usage.collaborators.current / (usage.collaborators.limit || 1)) * 100)}%` }}
                  />
                </div>
              )}
              {usage.collaborators.reason && (
                <p className="text-xs text-amber-700 mt-1">{usage.collaborators.reason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-slate-500 text-center">
        Billing is managed by Stripe. Your payment details are never stored on our servers.
      </p>
    </div>
  );
}
