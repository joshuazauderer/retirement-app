'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SimpleLineChart } from '@/components/calculators/SimpleLineChart';
import type { ScenarioComparisonResult, ScenarioSummary } from '@/server/scenarios/types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const directionColors: Record<string, string> = {
  better: 'text-green-700',
  worse: 'text-red-700',
  neutral: 'text-slate-600',
};

function readinessBadge(status: string) {
  const c =
    status === 'Strong'
      ? 'bg-green-100 text-green-800'
      : status === 'Needs Attention'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c}`}>{status}</span>
  );
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioA, setScenarioA] = useState(searchParams.get('a') ?? '');
  const [scenarioB, setScenarioB] = useState(searchParams.get('b') ?? '');
  const [comparison, setComparison] = useState<ScenarioComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/scenarios').then(r => r.json()).then(d => setScenarios(d.scenarios ?? []));
  }, []);

  useEffect(() => {
    if (scenarioA && scenarioB && scenarioA !== scenarioB) {
      setLoading(true); setError(null);
      fetch(`/api/scenarios/compare?a=${scenarioA}&b=${scenarioB}`)
        .then(r => r.json())
        .then(d => {
          if (d.comparison) setComparison(d.comparison);
          else setError((d.error as string) ?? 'Failed to compare');
        })
        .catch(() => setError('Comparison failed'))
        .finally(() => setLoading(false));
    }
  }, [scenarioA, scenarioB]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compare Scenarios</h1>
        <p className="text-slate-500 mt-1">See how two retirement plans compare side by side.</p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Scenario A</label>
          <select
            value={scenarioA}
            onChange={e => setScenarioA(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isBaseline ? ' (Baseline)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Scenario B</label>
          <select
            value={scenarioB}
            onChange={e => setScenarioB(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isBaseline ? ' (Baseline)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-slate-400">Running projections...</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {comparison && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            {[comparison.scenarioA, comparison.scenarioB].map((s) => (
              <div
                key={s.id}
                className={`bg-white rounded-xl border p-5 ${s.isBaseline ? 'border-blue-200' : 'border-slate-200'}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-slate-900">{s.name}</h3>
                  {s.isBaseline && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      Baseline
                    </span>
                  )}
                  {readinessBadge(s.readinessStatus)}
                </div>
                <div className="space-y-1.5 text-sm">
                  {(
                    [
                      ['Ending Balance', fmt(s.endingBalance)],
                      ['Ending Net Worth', fmt(s.endingNetWorth)],
                      ['First Depletion', s.firstDepletionYear?.toString() ?? 'None'],
                      ['Years Funded', `${s.yearsFullyFunded} / ${s.yearsProjected}`],
                      ['Retirement Year', s.firstRetirementYear?.toString() ?? 'N/A'],
                      ['Total Withdrawals', fmt(s.totalWithdrawals)],
                    ] as [string, string][]
                  ).map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Assumption diffs */}
          {comparison.assumptionDiffs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">What Changed (A → B)</h3>
              <div className="divide-y divide-slate-100">
                {comparison.assumptionDiffs.map((d, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-slate-600">{d.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-400">{d.baseline}</span>
                      <span className="text-slate-300">→</span>
                      <span className="font-medium text-slate-900">{d.scenario}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcome diffs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Outcome Differences (B vs A)</h3>
            <div className="divide-y divide-slate-100">
              {comparison.outcomeDiffs.map((d, i) => (
                <div key={i} className="flex justify-between items-center py-2 text-sm">
                  <span className="text-slate-600">{d.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-slate-400">{d.baseline}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-medium">{d.scenario}</span>
                    <span className={`font-semibold ${directionColors[d.direction] ?? 'text-slate-600'}`}>
                      {d.delta}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart: Asset balances */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Portfolio Balance Over Time</h3>
            <SimpleLineChart
              series={[
                {
                  name: comparison.scenarioA.name,
                  color: '#3b82f6',
                  data: comparison.scenarioA.yearByYear.map(y => ({ x: y.year, y: y.endingTotalAssets })),
                },
                {
                  name: comparison.scenarioB.name,
                  color: '#f59e0b',
                  data: comparison.scenarioB.yearByYear.map(y => ({ x: y.year, y: y.endingTotalAssets })),
                },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-slate-400">Loading...</div>}>
      <ComparePageInner />
    </Suspense>
  );
}
