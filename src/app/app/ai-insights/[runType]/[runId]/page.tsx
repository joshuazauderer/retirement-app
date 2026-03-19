import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { InsightPanel } from '@/components/ai/InsightPanel';
import {
  buildInsightInputFromTaxRun,
  buildInsightInputFromHealthcareRun,
  buildInsightInputFromHousingRun,
} from '@/server/ai/aiInsightService';
import type { InsightInput } from '@/server/ai/types';

type RunType = 'tax' | 'healthcare' | 'housing';

interface PageProps {
  params: { runType: string; runId: string };
}

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

async function buildInsightInput(
  runType: RunType,
  runId: string,
  householdId: string,
): Promise<{ input: InsightInput; runLabel: string; scenarioName: string } | null> {
  if (runType === 'tax') {
    const run = await prisma.taxPlanningRun.findFirst({
      where: { id: runId, householdId },
      include: { scenario: { select: { name: true } } },
    });
    if (!run) return null;

    const summaryJson = run.summaryJson as Record<string, unknown>;
    const endingAssets = typeof summaryJson?.endingAssets === 'number' ? summaryJson.endingAssets : 0;

    const input = buildInsightInputFromTaxRun({
      householdId,
      runId: run.id,
      scenarioName: run.scenario?.name ?? run.label ?? 'Tax Planning Run',
      success: run.success,
      firstDepletionYear: run.firstDepletionYear,
      totalFederalTax: Number(run.totalFederalTax),
      totalStateTax: Number(run.totalStateTax),
      totalLifetimeTax: Number(run.totalLifetimeTax),
      endingAssets,
      projectionStartYear: run.projectionStartYear,
      projectionEndYear: run.projectionEndYear,
    });

    return { input, runLabel: run.label ?? 'Tax Planning Run', scenarioName: run.scenario?.name ?? 'Default' };
  }

  if (runType === 'healthcare') {
    const run = await prisma.healthcarePlanningRun.findFirst({
      where: { id: runId, householdId },
      include: { scenario: { select: { name: true } } },
    });
    if (!run) return null;

    const input = buildInsightInputFromHealthcareRun({
      householdId,
      runId: run.id,
      scenarioName: run.scenario?.name ?? run.label ?? 'Healthcare Run',
      success: run.success,
      firstDepletionYear: run.firstDepletionYear,
      totalHealthcareCost: run.totalHealthcareCost,
      endingAssets: run.endingAssets,
      projectionStartYear: run.projectionStartYear,
      projectionEndYear: run.projectionEndYear,
      hasLtcStress: run.hasLtcStress,
      hasLongevityStress: run.hasLongevityStress,
      longevityTargetAge: run.longevityTargetAge,
    });

    return { input, runLabel: run.label ?? 'Healthcare Run', scenarioName: run.scenario?.name ?? 'Default' };
  }

  if (runType === 'housing') {
    const run = await prisma.housingPlanningRun.findFirst({
      where: { id: runId, householdId },
      include: { scenario: { select: { name: true } } },
    });
    if (!run) return null;

    const input = buildInsightInputFromHousingRun({
      householdId,
      runId: run.id,
      scenarioName: run.scenario?.name ?? run.label ?? 'Housing Run',
      success: run.success,
      firstDepletionYear: run.firstDepletionYear,
      endingAssets: run.endingFinancialAssets,
      netEstateValue: run.projectedNetEstate,
      netEquityReleased: run.netReleasedEquity,
      projectionStartYear: run.projectionStartYear,
      projectionEndYear: run.projectionEndYear,
      strategy: run.strategy,
    });

    return { input, runLabel: run.label ?? 'Housing Run', scenarioName: run.scenario?.name ?? 'Default' };
  }

  return null;
}

export default async function AiInsightDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const runType = params.runType as RunType;
  if (!['tax', 'healthcare', 'housing'].includes(runType)) notFound();

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) redirect('/app/ai-insights');

  const result = await buildInsightInput(runType, params.runId, householdId);
  if (!result) notFound();

  const { input, runLabel, scenarioName } = result;

  const runTypeLabels: Record<RunType, string> = {
    tax: 'Tax Planning',
    healthcare: 'Healthcare Planning',
    housing: 'Housing Planning',
  };

  const runTypeHref: Record<RunType, string> = {
    tax: '/app/tax-planning',
    healthcare: '/app/healthcare-planning',
    housing: '/app/housing-planning',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 print:max-w-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 print:hidden">
        <Link href="/app/ai-insights" className="hover:text-slate-700 transition-colors">
          AI Insights
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={runTypeHref[runType]} className="hover:text-slate-700 transition-colors">
          {runTypeLabels[runType]}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-slate-800 font-medium">{runLabel}</span>
      </nav>

      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{runLabel}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Scenario: {scenarioName} &middot; {runTypeLabels[runType]}</p>
      </div>

      {/* Run summary card */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Plan Status</p>
          <p className={`font-semibold ${input.success ? 'text-green-700' : 'text-red-700'}`}>
            {input.success ? 'Fully Funded' : `Depletes ${input.firstDepletionYear ?? 'early'}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Projection Period</p>
          <p className="font-semibold text-slate-800">
            {input.projectionStartYear}–{input.projectionEndYear}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Ending Assets</p>
          <p className="font-semibold text-slate-800">
            ${Math.round(input.endingAssets).toLocaleString()}
          </p>
        </div>
        {input.totalTaxes != null && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Lifetime Taxes</p>
            <p className="font-semibold text-slate-800">${Math.round(input.totalTaxes).toLocaleString()}</p>
          </div>
        )}
        {input.totalHealthcareCost != null && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Lifetime Healthcare</p>
            <p className="font-semibold text-slate-800">${Math.round(input.totalHealthcareCost).toLocaleString()}</p>
          </div>
        )}
        {input.netEstateValue != null && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Net Estate Value</p>
            <p className="font-semibold text-slate-800">${Math.round(input.netEstateValue).toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* AI Insight Panel — client component */}
      <InsightPanel input={input} />

      {/* Print styles */}
      <style>{`
        @media print {
          nav { display: none; }
          .print\\:hidden { display: none; }
          body { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
