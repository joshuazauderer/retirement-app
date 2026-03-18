'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BandChart } from '@/components/monteCarlo/BandChart';
import type { MonteCarloListItem, MonteCarloComparisonResult } from '@/server/monteCarlo/types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

const directionColors: Record<string, string> = {
  better: 'text-green-700',
  worse: 'text-red-700',
  neutral: 'text-slate-600',
};

function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [runs, setRuns] = useState<MonteCarloListItem[]>([]);
  const [runA, setRunA] = useState(searchParams.get('a') ?? '');
  const [runB, setRunB] = useState(searchParams.get('b') ?? '');
  const [comparison, setComparison] = useState<MonteCarloComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/monte-carlo').then(r => r.json()).then(d => setRuns(d.runs ?? []));
  }, []);

  useEffect(() => {
    if (runA && runB && runA !== runB) {
      setLoading(true); setError(null); setComparison(null);
      fetch(`/api/monte-carlo/compare?a=${runA}&b=${runB}`)
        .then(r => r.json())
        .then(d => {
          if (d.comparison) setComparison(d.comparison);
          else setError(d.error ?? 'Comparison failed');
        })
        .catch(() => setError('Network error'))
        .finally(() => setLoading(false));
    }
  }, [runA, runB]);

  const runLabel = (r: MonteCarloListItem) =>
    `${r.label ?? r.scenarioName} — ${(r.successProbability * 100).toFixed(0)}% success`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compare Monte Carlo Runs</h1>
        <p className="text-slate-500 mt-1">
          See how two probability analyses differ in assumptions and outcomes.
        </p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Run A', value: runA, set: setRunA },
          { label: 'Run B', value: runB, set: setRunB },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <label className="text-sm font-medium text-slate-700">{label}</label>
            <select
              value={value}
              onChange={e => set(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a simulation...</option>
              {runs.map(r => (
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
            {[comparison.runA, comparison.runB].map((r, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const agg = r.aggregation as any;
              const successColor =
                agg.success.successProbability >= 0.85
                  ? 'bg-green-50 border-green-200'
                  : agg.success.successProbability >= 0.70
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-50 border-red-200';
              return (
                <div key={i} className={`rounded-xl border p-5 ${successColor}`}>
                  <h3 className="font-semibold text-slate-900 mb-3">
                    {i === 0 ? 'Run A' : 'Run B'}: {r.scenarioName}
                  </h3>
                  <div className="space-y-1.5 text-sm">
                    {[
                      ['Success Probability', pct(agg.success.successProbability)],
                      ['Median Ending Assets', fmt(agg.endingAssets.p50)],
                      ['P10 Ending Assets', fmt(agg.endingAssets.p10)],
                      ['P90 Ending Assets', fmt(agg.endingAssets.p90)],
                      ['Depletion Probability', pct(agg.success.failureProbability)],
                      ['Median Depletion Year', agg.success.medianDepletionYear?.toString() ?? 'None'],
                      ['Simulation Count', r.simulationCount.toLocaleString()],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Assumption diffs */}
          {comparison.assumptionDiffs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Assumption Differences</h3>
              <div className="divide-y divide-slate-100">
                {comparison.assumptionDiffs.map((d, i) => (
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
                    <span className={`font-semibold ${directionColors[d.direction] ?? 'text-slate-600'}`}>
                      {d.delta}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Median balance charts */}
          <div className="grid grid-cols-2 gap-4">
            {[comparison.runA, comparison.runB].map((r, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  {i === 0 ? 'Run A' : 'Run B'}: {r.scenarioName}
                </h4>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <BandChart bands={(r.aggregation as any).balanceBands} height={180} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/app/monte-carlo')}>
          ← All Simulations
        </Button>
      </div>
    </div>
  );
}

export default function MonteCarloComparePage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-slate-400">Loading...</div>}>
      <ComparePageInner />
    </Suspense>
  );
}
