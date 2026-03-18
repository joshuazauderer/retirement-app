'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/calculators/StatCard';
import type { WithdrawalStrategyRunResult, WithdrawalYearResult } from '@/server/withdrawalStrategies/types';
import { strategyTypeLabel } from '@/server/withdrawalStrategies/withdrawalPolicyEngine';
import { orderingTypeLabel } from '@/server/withdrawalStrategies/withdrawalOrderingService';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

function OutcomeBanner({ success, firstDepletionYear }: { success: boolean; firstDepletionYear: number | null }) {
  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <div className="font-semibold text-green-800">Plan is Fully Funded</div>
          <div className="text-sm text-green-700">Assets are sufficient through the entire projection period under this strategy.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
      <span className="text-2xl">⚠️</span>
      <div>
        <div className="font-semibold text-red-800">Plan Depletes in {firstDepletionYear}</div>
        <div className="text-sm text-red-700">
          Assets are exhausted before the end of the projection. Consider reducing withdrawal targets,
          increasing savings, or adjusting retirement timing.
        </div>
      </div>
    </div>
  );
}

function WithdrawalBucketBar({ byBucket }: { byBucket: WithdrawalYearResult['withdrawalByBucket'] }) {
  const total = byBucket.taxable + byBucket.taxDeferred + byBucket.taxFree;
  if (total <= 0) return <div className="text-xs text-slate-400">No withdrawal</div>;
  const bars = [
    { label: 'Taxable', value: byBucket.taxable, color: 'bg-blue-400' },
    { label: 'Tax-Deferred', value: byBucket.taxDeferred, color: 'bg-amber-400' },
    { label: 'Tax-Free', value: byBucket.taxFree, color: 'bg-green-400' },
  ].filter((b) => b.value > 0);

  return (
    <div className="flex h-2 rounded overflow-hidden gap-px">
      {bars.map((b) => (
        <div key={b.label} className={b.color} style={{ width: `${(b.value / total) * 100}%` }} title={`${b.label}: ${fmt(b.value)}`} />
      ))}
    </div>
  );
}

export default function WithdrawalStrategyResultPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  const [run, setRun] = useState<WithdrawalStrategyRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllYears, setShowAllYears] = useState(false);

  useEffect(() => {
    fetch(`/api/withdrawal-strategies/${runId}`)
      .then((r) => r.json())
      .then((d) => { setRun(d.run); setLoading(false); });
  }, [runId]);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading...</div>;
  if (!run) return <div className="text-center py-16 text-slate-400">Run not found.</div>;

  const retirementYears = run.yearByYear.filter((y) => y.requestedWithdrawal > 0 || y.actualWithdrawal > 0);
  const displayYears = showAllYears ? run.yearByYear : run.yearByYear.slice(0, 30);

  const totalByBucket = run.yearByYear.reduce(
    (acc, y) => ({
      taxable: acc.taxable + y.withdrawalByBucket.taxable,
      taxDeferred: acc.taxDeferred + y.withdrawalByBucket.taxDeferred,
      taxFree: acc.taxFree + y.withdrawalByBucket.taxFree,
    }),
    { taxable: 0, taxDeferred: 0, taxFree: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{run.label}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {run.scenarioName} · {strategyTypeLabel(run.config.strategyType)} · {orderingTypeLabel(run.config.orderingType)} ·{' '}
            {new Date(run.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/app/withdrawal-strategies/compare?a=${runId}`)}>
            Compare
          </Button>
          <Button onClick={() => router.push('/app/withdrawal-strategies/new')}>
            New Analysis
          </Button>
        </div>
      </div>

      {/* Outcome banner */}
      <OutcomeBanner success={run.success} firstDepletionYear={run.firstDepletionYear} />

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Ending Assets"
          value={fmt(run.endingAssets)}
          highlight={run.success ? 'green' : 'red'}
        />
        <StatCard label="Total Withdrawals" value={fmt(run.totalWithdrawals)} />
        <StatCard label="Avg Annual Withdrawal" value={fmt(run.averageAnnualWithdrawal)} />
        <StatCard label="Max Annual Withdrawal" value={fmt(run.maxAnnualWithdrawal)} />
        <StatCard label="Total Taxes" value={fmt(run.totalTaxes)} />
        <StatCard label="Years Fully Funded" value={run.yearsFullyFunded.toString()} />
        <StatCard
          label="First Depletion"
          value={run.firstDepletionYear?.toString() ?? 'Never'}
          highlight={run.firstDepletionYear ? 'red' : 'green'}
        />
        <StatCard label="Ending Net Worth" value={fmt(run.endingNetWorth)} />
      </div>

      {/* Tax bucket breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Lifetime Withdrawal by Tax Bucket</h3>
        <div className="space-y-2">
          {[
            { label: 'Taxable Accounts', value: totalByBucket.taxable, color: 'bg-blue-400' },
            { label: 'Tax-Deferred (Pre-Tax)', value: totalByBucket.taxDeferred, color: 'bg-amber-400' },
            { label: 'Tax-Free (Roth/HSA)', value: totalByBucket.taxFree, color: 'bg-green-400' },
          ].map(({ label, value, color }) => {
            const total = totalByBucket.taxable + totalByBucket.taxDeferred + totalByBucket.taxFree;
            const share = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={label} className="flex items-center gap-3">
                <div className="w-36 text-sm text-slate-600 shrink-0">{label}</div>
                <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden">
                  <div className={`${color} h-full rounded`} style={{ width: `${share}%` }} />
                </div>
                <div className="w-28 text-sm text-right font-medium text-slate-900">{fmt(value)}</div>
                <div className="w-12 text-xs text-slate-400 text-right">{share.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assumptions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Strategy Assumptions</h3>
        <div className="divide-y divide-slate-100">
          {[
            ['Strategy Type', strategyTypeLabel(run.config.strategyType)],
            ['Account Ordering', orderingTypeLabel(run.config.orderingType)],
            ...(run.config.annualWithdrawalTarget !== undefined
              ? [['Annual Target', fmt(run.config.annualWithdrawalTarget)]]
              : []),
            ...(run.config.guardrailConfig
              ? [
                  ['Initial Withdrawal', fmt(run.config.guardrailConfig.initialAnnualWithdrawal)],
                  ['Lower Guardrail', pct(run.config.guardrailConfig.lowerGuardrailPct)],
                  ['Upper Guardrail', pct(run.config.guardrailConfig.upperGuardrailPct)],
                  ['Spending Cut', pct(run.config.guardrailConfig.decreaseStepPct)],
                  ['Spending Increase', pct(run.config.guardrailConfig.increaseStepPct)],
                ]
              : []),
            ['Projection', `${run.projectionStartYear}–${run.projectionEndYear}`],
            ['Scenario', run.scenarioName],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-slate-900">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Year-by-year table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Year-by-Year Detail</h3>
          <span className="text-xs text-slate-400">
            {retirementYears.length} retirement years
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Year</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">Begin Assets</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">Requested</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">Actual</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">Shortfall</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">Expenses</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">Benefits</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">Taxes</th>
                <th className="px-3 py-2 text-right text-slate-500 font-medium">End Assets</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Buckets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayYears.map((y) => (
                <tr
                  key={y.year}
                  className={`${y.depleted ? 'bg-red-50' : ''} ${y.guardrailDirection === 'reduced' ? 'bg-amber-50' : ''}`}
                >
                  <td className="px-3 py-1.5 text-slate-700 font-medium">
                    {y.year}
                    {y.guardrailDirection === 'reduced' && <span className="ml-1 text-amber-600" title="Guardrail reduced">↓</span>}
                    {y.guardrailDirection === 'increased' && <span className="ml-1 text-green-600" title="Guardrail increased">↑</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmt(y.beginningAssets)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmt(y.requestedWithdrawal)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-900 font-medium">{fmt(y.actualWithdrawal)}</td>
                  <td className={`px-3 py-1.5 text-right ${y.shortfall > 0 ? 'text-red-600 font-medium' : 'text-slate-300'}`}>
                    {y.shortfall > 0 ? fmt(y.shortfall) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmt(y.expenses)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmt(y.benefits)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmt(y.taxes)}</td>
                  <td className={`px-3 py-1.5 text-right font-medium ${y.endingAssets < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {fmt(y.endingAssets)}
                  </td>
                  <td className="px-3 py-1.5 w-24">
                    <WithdrawalBucketBar byBucket={y.withdrawalByBucket} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {run.yearByYear.length > 30 && (
          <div className="px-5 py-3 border-t border-slate-100 text-center">
            <button
              onClick={() => setShowAllYears(!showAllYears)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showAllYears ? 'Show fewer years' : `Show all ${run.yearByYear.length} years`}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/app/withdrawal-strategies')}>
          ← All Strategies
        </Button>
        <Button variant="outline" onClick={() => router.push(`/app/scenarios/${run.scenarioId}`)}>
          View Scenario
        </Button>
        <Button variant="outline" onClick={() => router.push('/app/sequence-risk')}>
          Sequence Risk Analysis
        </Button>
      </div>
    </div>
  );
}
