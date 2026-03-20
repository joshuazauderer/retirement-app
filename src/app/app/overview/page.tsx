import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getDashboardOverview } from '@/server/dashboard/dashboardOverviewService';
import { PlanHealthHeroCard } from '@/components/dashboard/PlanHealthHeroCard';
import { NextActionsPanel } from '@/components/dashboard/NextActionsPanel';
import { PlanCompletionCard } from '@/components/dashboard/PlanCompletionCard';
import { DashboardMetricsGrid } from '@/components/dashboard/DashboardMetricsGrid';
import { ScenarioSnapshotCard } from '@/components/dashboard/ScenarioSnapshotCard';
import { DataFreshnessCard } from '@/components/dashboard/DataFreshnessCard';
import { NextReviewCard } from '@/components/dashboard/NextReviewCard';
import { AIInsightSummaryCard } from '@/components/dashboard/AIInsightSummaryCard';
import { AlertsSummaryCard } from '@/components/dashboard/AlertsSummaryCard';
import { UpgradeValueCard } from '@/components/dashboard/UpgradeValueCard';

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const household = await prisma.household.findUnique({
    where: { primaryUserId: session.user.id },
  });
  if (!household) redirect('/onboarding');

  const vm = await getDashboardOverview(session.user.id, household.id, household.name);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {vm.isNewUser ? 'Welcome to RetirePlan' : 'Your Retirement Plan'}
        </h1>
        <p className="text-slate-500 mt-0.5">{household.name}</p>
      </div>

      {/* Row 1: Plan Health Hero — Full Width */}
      <PlanHealthHeroCard planHealth={vm.planHealth} />

      {/* Row 2: Next Steps + Completion — 3/5 + 2/5 */}
      <div id="next-steps" className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <NextActionsPanel actions={vm.nextActions} />
        </div>
        <div className="lg:col-span-2">
          <PlanCompletionCard completion={vm.completion} />
        </div>
      </div>

      {/* Row 3: Key Metrics Grid — Full Width */}
      <DashboardMetricsGrid metrics={vm.metrics} />

      {/* Row 4: Scenarios + Data Freshness + Next Review — 3 equal columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ScenarioSnapshotCard scenarios={vm.scenarios} />
        <DataFreshnessCard freshness={vm.dataFreshness} />
        <NextReviewCard review={vm.reviewCadence} />
      </div>

      {/* Row 5: AI Insights + Alerts — 1/2 + 1/2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AIInsightSummaryCard insight={vm.insight} />
        <AlertsSummaryCard alerts={vm.alerts} />
      </div>

      {/* Row 6: Upgrade Card — conditional */}
      <UpgradeValueCard upgrade={vm.upgradePrompt} />
    </div>
  );
}
