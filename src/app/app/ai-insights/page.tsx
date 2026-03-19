import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export default async function AiInsightsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-slate-500">No household found. Please complete onboarding first.</p>
      </div>
    );
  }

  // Fetch recent runs (last 5 each)
  const [taxRuns, healthcareRuns, housingRuns] = await Promise.all([
    prisma.taxPlanningRun.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        label: true,
        success: true,
        totalLifetimeTax: true,
        firstDepletionYear: true,
        createdAt: true,
        scenario: { select: { name: true } },
      },
    }),
    prisma.healthcarePlanningRun.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        label: true,
        success: true,
        totalHealthcareCost: true,
        firstDepletionYear: true,
        createdAt: true,
        scenario: { select: { name: true } },
      },
    }),
    prisma.housingPlanningRun.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        label: true,
        success: true,
        strategy: true,
        netReleasedEquity: true,
        firstDepletionYear: true,
        createdAt: true,
        scenario: { select: { name: true } },
      },
    }),
  ]);

  const totalRuns = taxRuns.length + healthcareRuns.length + housingRuns.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-900">AI Insights</h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
            Beta
          </span>
        </div>
        <p className="text-slate-600 max-w-2xl">
          AI Insights explain your retirement plan results in plain language. They identify risk factors,
          describe tradeoffs, and surface options worth exploring — but are not financial advice.
        </p>
      </div>

      {/* What AI Insights are and are not */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-blue-900">How AI Insights work</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-blue-800 mb-1">What they are</p>
            <ul className="space-y-1 text-blue-700">
              <li>Planning-grade explanations of your analysis results</li>
              <li>Risk identification based on computed plan data</li>
              <li>Non-authoritative suggestions in plain language</li>
              <li>Structured summaries of tax, healthcare, and housing runs</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-blue-800 mb-1">What they are not</p>
            <ul className="space-y-1 text-blue-700">
              <li>Financial, legal, or tax advice</li>
              <li>Guaranteed predictions of future outcomes</li>
              <li>A replacement for a qualified financial professional</li>
              <li>Recalculations — AI never overrides engine outputs</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-blue-600 italic">
          To use: run any analysis (tax planning, healthcare, housing), then click &ldquo;Generate AI Insight&rdquo; to see an explanation of those results.
        </p>
      </div>

      {totalRuns === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-slate-500 mb-4">No analysis runs found yet.</p>
          <p className="text-sm text-slate-400">
            Run a{' '}
            <Link href="/app/tax-planning" className="text-blue-600 hover:underline">Tax Planning</Link>,{' '}
            <Link href="/app/healthcare-planning" className="text-blue-600 hover:underline">Healthcare</Link>, or{' '}
            <Link href="/app/housing-planning" className="text-blue-600 hover:underline">Housing Planning</Link>{' '}
            analysis first, then return here to generate AI insights.
          </p>
        </div>
      )}

      {/* Tax Planning Runs */}
      {taxRuns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Tax Planning Runs</h2>
          <div className="space-y-2">
            {taxRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{run.label || 'Tax Planning Run'}</p>
                  <p className="text-xs text-slate-500">
                    {run.scenario?.name ?? 'No scenario'} &middot;{' '}
                    {run.success ? (
                      <span className="text-green-600">Fully funded</span>
                    ) : (
                      <span className="text-red-600">Depletes {run.firstDepletionYear ?? 'early'}</span>
                    )}{' '}
                    &middot; Lifetime taxes: ${Math.round(Number(run.totalLifetimeTax)).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/app/ai-insights/tax/${run.id}`}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors whitespace-nowrap"
                >
                  Get AI Insight
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Healthcare Runs */}
      {healthcareRuns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Healthcare Planning Runs</h2>
          <div className="space-y-2">
            {healthcareRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{run.label || 'Healthcare Run'}</p>
                  <p className="text-xs text-slate-500">
                    {run.scenario?.name ?? 'No scenario'} &middot;{' '}
                    {run.success ? (
                      <span className="text-green-600">Fully funded</span>
                    ) : (
                      <span className="text-red-600">Depletes {run.firstDepletionYear ?? 'early'}</span>
                    )}{' '}
                    &middot; Lifetime healthcare: ${Math.round(run.totalHealthcareCost).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/app/ai-insights/healthcare/${run.id}`}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors whitespace-nowrap"
                >
                  Get AI Insight
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Housing Runs */}
      {housingRuns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Housing Planning Runs</h2>
          <div className="space-y-2">
            {housingRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{run.label || 'Housing Run'}</p>
                  <p className="text-xs text-slate-500">
                    {run.scenario?.name ?? 'No scenario'} &middot;{' '}
                    {run.strategy.replace(/_/g, ' ')} &middot;{' '}
                    {run.success ? (
                      <span className="text-green-600">Fully funded</span>
                    ) : (
                      <span className="text-red-600">Depletes {run.firstDepletionYear ?? 'early'}</span>
                    )}{' '}
                    {run.netReleasedEquity > 0 && (
                      <>&middot; Equity released: ${Math.round(run.netReleasedEquity).toLocaleString()}</>
                    )}
                  </p>
                </div>
                <Link
                  href={`/app/ai-insights/housing/${run.id}`}
                  className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors whitespace-nowrap"
                >
                  Get AI Insight
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
