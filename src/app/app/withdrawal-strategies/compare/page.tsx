'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type {
  WithdrawalStrategySummaryItem,
  WithdrawalStrategyComparisonResult,
} from '@/server/withdrawalStrategies/types';
import { strategyTypeLabel } from '@/server/withdrawalStrategies/withdrawalPolicyEngine';
import { orderingTypeLabel } from '@/server/withdrawalStrategies/withdrawalOrderingService';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const dirColors: Record<string, string> = {
  better: 'text-green-700',
  worse: 'text-red-700',
  neutral: 'text-slate-600',
};

function SummaryCard({ run }: { run: WithdrawalStrategyComparisonResult['runA'] }) {
  const color = run.success
    ? 'bg-green-50 border-green-200'
    : 'bg-red-50 border-red-200';
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <h3 className="font-semibold text-slate-900 mb-3 truncate">{run.label}</h3>
      <div className="text-xs text-slate-500 mb-3">
        {strategyTypeLabel(run.config.strategyType)} · {orderingTypeLabel(run.config.orderingType)}
      </div>
      <div className="space-y-1.5 text-sm">
        {[
          ['Scenario', run.scenarioName],
          ['Status', run.success ? '✅ Funded' : '⚠️ Depletes'],
          ['Ending Assets', fmt(run.endingAssets)],
          ['Total Withdrawals', fmt(run.totalWithdrawals)],
          ['Avg Annual Withdrawal', fmt(run.averageAnnualWithdrawal)],
          ['Total Taxes', fmt(run.totalTaxes)],
          ['First Depletion', run.firstDepletionYear?.toString() ?? 'Never'],
          ['Years Fully Funded', run.yearsFullyFunded.toString()],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between">
            <span className="text-slate-500">{label}</span>
            <span className="font-medium">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [runs, setRuns] = useState<WithdrawalStrategySummaryItem[]>([]);
  const [runA, setRunA] = useState(searchParams.get('a') ?? '');
  const [runB, setRunB] = useState(searchParams.get('b') ?? '');
  const [comparison, setComparison] = useState<WithdrawalStrategyComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/withdrawal-strategies')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []));
  }, []);

  useEffect(() => {
    if (runA && runB && runA !== runB) {
      setLoading(true); setError(null); setComparison(null);
      fetch(`/api/withdrawal-strategies/compare?a=${runA}&b=${runB}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.comparison) setComparison(d.comparison);
          else setError(d.error ?? 'Comparison failed.');
        })
        .catch(() => setError('Network error.'))
        .finally(() => setLoading(false));
    }
  }, [runA, runB]);

  const runLabel = (r: WithdrawalStrategySummaryItem) =>
    `${r.label} — ${r.success ? 'Funded' : 'Depletes'}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compare Withdrawal Strategies</h1>
        <p className="text-slate-500 mt-1">
          Side-by-side comparison of two strategy runs on the same or different scenarios.
        </p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Strategy A', value: runA, set: setRunA },
          { label: 'Strategy B', value: runB, set: setRunB },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label className="text-sm font-medium text-slate-700">{label}</label>
            <select
              value={value}
              onChange={(e) => set(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a strategy run...</option>
              {runs.map((r) => (
                <option key={r.runId} value={r.runId}>{runLabel(r)}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {loading && <div className="text-center py-8 text-slate-400">Loading comparison...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {comparison && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard run={comparison.runA} />
            <SummaryCard run={comparison.runB} />
          </div>

          {/* Config diffs */}
          {comparison.configDiffs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Configuration Differences</h3>
              <div className="divide-y divide-slate-100">
                {comparison.configDiffs.map((d, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-slate-600">{d.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-400">{d.a}</span>
                      <span className="text-slate-300">→</span>
                      <span className="font-medium text-slate-900">{d.b}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcome diffs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Outcome Differences (A → B)</h3>
            <div className="divide-y divide-slate-100">
              {comparison.outcomeDiffs.map((d, i) => (
                <div key={i} className="flex justify-between items-center py-2 text-sm">
                  <span className="text-slate-600">{d.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-slate-400">{d.a}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-medium">{d.b}</span>
                    {d.delta && (
                      <span className={`font-semibold ${dirColors[d.direction] ?? 'text-slate-600'}`}>
                        {d.delta}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/app/withdrawal-strategies')}>
          ← All Strategies
        </Button>
      </div>
    </div>
  );
}

export default function WithdrawalStrategyComparePage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-slate-400">Loading...</div>}>
      <ComparePageInner />
    </Suspense>
  );
}
