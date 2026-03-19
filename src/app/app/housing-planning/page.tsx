'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HousingPlanningSummaryItem } from '@/server/housing/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function StrategyBadge({ strategy }: { strategy: string }) {
  const colors: Record<string, string> = {
    stay_in_place: 'bg-slate-100 text-slate-600',
    downsize: 'bg-blue-100 text-blue-700',
    relocate: 'bg-purple-100 text-purple-700',
    rent: 'bg-orange-100 text-orange-700',
  };
  const labels: Record<string, string> = {
    stay_in_place: 'Stay in Place',
    downsize: 'Downsize',
    relocate: 'Relocate',
    rent: 'Rent',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[strategy] ?? 'bg-slate-100 text-slate-600'}`}>
      {labels[strategy] ?? strategy}
    </span>
  );
}

export default function HousingPlanningIndexPage() {
  const [runs, setRuns] = useState<HousingPlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runA, setRunA] = useState('');
  const [runB, setRunB] = useState('');

  useEffect(() => {
    fetch('/api/housing-planning')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setRuns(d.runs ?? []);
      })
      .catch(() => setError('Failed to load runs.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading...</div>;
  if (error) return <div className="text-red-500 py-12 text-center">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Housing Planning</h1>
          <p className="text-slate-500 text-sm mt-1">
            Model downsizing, relocation, and legacy outcomes across your retirement.
          </p>
        </div>
        <Link href="/app/housing-planning/new">
          <Button>+ New Analysis</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <strong>Planning estimates only.</strong> Not real-estate, tax, or legal advice. Equity release and legacy figures are planning approximations only.
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <p className="text-lg font-medium mb-2">No housing analyses yet</p>
          <p className="text-sm mb-4">Create your first analysis to explore housing strategies and legacy outcomes.</p>
          <Link href="/app/housing-planning/new">
            <Button>Create Analysis</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* A/B comparison selector */}
          {runs.length >= 2 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h2 className="font-semibold text-slate-900 text-sm">A/B Compare</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                  value={runA}
                  onChange={(e) => setRunA(e.target.value)}
                >
                  <option value="">Run A…</option>
                  {runs.map((r) => (
                    <option key={r.runId} value={r.runId}>{r.label}</option>
                  ))}
                </select>
                <span className="text-slate-400 text-sm">vs</span>
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                  value={runB}
                  onChange={(e) => setRunB(e.target.value)}
                >
                  <option value="">Run B…</option>
                  {runs.map((r) => (
                    <option key={r.runId} value={r.runId}>{r.label}</option>
                  ))}
                </select>
                <Link
                  href={runA && runB ? `/app/housing-planning/compare?runA=${runA}&runB=${runB}` : '#'}
                >
                  <Button variant="outline" size="sm" disabled={!runA || !runB}>
                    Compare
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Runs list */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th className="px-4 py-3 text-right">Net Equity Released</th>
                  <th className="px-4 py-3 text-right">Ending Assets</th>
                  <th className="px-4 py-3 text-right">Projected Estate</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Scenario</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <tr key={r.runId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.label}</td>
                    <td className="px-4 py-3"><StrategyBadge strategy={r.strategy} /></td>
                    <td className="px-4 py-3 text-right">{fmt(r.netReleasedEquity)}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.endingFinancialAssets)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(r.projectedNetEstate)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.success ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Funded</span>
                      ) : (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                          Depleted {r.firstDepletionYear}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.scenarioName}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/app/housing-planning/${r.runId}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
