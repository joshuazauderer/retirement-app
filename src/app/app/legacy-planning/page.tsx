'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HousingPlanningSummaryItem } from '@/server/housing/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function LegacyPlanningPage() {
  const [runs, setRuns] = useState<HousingPlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runA, setRunA] = useState('');
  const [runB, setRunB] = useState('');

  useEffect(() => {
    fetch('/api/legacy-planning')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setRuns(d.runs ?? []);
      })
      .catch(() => setError('Failed to load runs.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Legacy Planning</h1>
          <p className="text-slate-500 text-sm mt-1">
            Project your estate value at end of plan across different housing and gifting strategies.
          </p>
        </div>
        <Link href="/app/housing-planning/new">
          <Button>+ New Analysis</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimate only.</strong> Not legal estate-planning advice. Does not account for estate taxes,
        probate, trust structures, or beneficiary designations. Consult an estate planning attorney and financial advisor.
      </div>

      {/* Educational content */}
      <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
        <h2 className="font-semibold text-slate-900 text-lg">Legacy Planning Concepts</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Projected Net Estate</h3>
            <p>
              At the end of your plan horizon, your projected estate equals financial assets plus real estate equity,
              minus any remaining liabilities. This is a planning estimate of what you may leave behind.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Housing Decisions and Legacy</h3>
            <p>
              Downsizing can release equity into investable assets that grow over time — potentially increasing
              your legacy. Staying in a larger home preserves real estate equity but may constrain cash flow.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Gifting Strategies</h3>
            <p>
              Annual exclusion gifts reduce your taxable estate while transferring wealth to heirs now.
              The 2024 annual exclusion is $18,000 per recipient. This tool does not model gift tax consequences.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Key Limitations</h3>
            <p>
              This projection does not include estate taxes, trust structures, probate costs, asset step-up basis,
              or survivor benefits. Work with an estate attorney and financial advisor for a complete plan.
            </p>
          </div>
        </div>
      </div>

      {/* Legacy runs table */}
      {loading ? (
        <div className="text-slate-400 py-12 text-center">Loading analyses...</div>
      ) : error ? (
        <div className="text-red-500 py-4">{error}</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <p className="text-lg font-medium mb-2">No legacy analyses yet</p>
          <p className="text-sm mb-4">Create a housing analysis with legacy projection enabled to see results here.</p>
          <Link href="/app/housing-planning/new">
            <Button>Create Analysis</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* A/B comparison */}
          {runs.length >= 2 && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h2 className="font-semibold text-slate-900 text-sm">Compare Legacy Outcomes</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                  value={runA}
                  onChange={(e) => setRunA(e.target.value)}
                >
                  <option value="">Run A…</option>
                  {runs.map((r) => <option key={r.runId} value={r.runId}>{r.label}</option>)}
                </select>
                <span className="text-slate-400 text-sm">vs</span>
                <select
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                  value={runB}
                  onChange={(e) => setRunB(e.target.value)}
                >
                  <option value="">Run B…</option>
                  {runs.map((r) => <option key={r.runId} value={r.runId}>{r.label}</option>)}
                </select>
                <Link href={runA && runB ? `/app/housing-planning/compare?runA=${runA}&runB=${runB}` : '#'}>
                  <Button variant="outline" size="sm" disabled={!runA || !runB}>Compare</Button>
                </Link>
              </div>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Projected Net Estate by Analysis</h2>
              <p className="text-xs text-slate-400 mt-0.5">Sorted by projected net estate, highest first.</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th className="px-4 py-3 text-right">Ending Financial Assets</th>
                  <th className="px-4 py-3 text-right">Net Equity Released</th>
                  <th className="px-4 py-3 text-right">Projected Net Estate</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r, i) => (
                  <tr key={r.runId} className={`hover:bg-slate-50 ${i === 0 ? 'bg-green-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      {i === 0 && <span className="text-xs text-green-600 mr-1 font-semibold">Highest</span>}
                      {r.label}
                    </td>
                    <td className="px-4 py-3 text-slate-500 capitalize">{r.strategy.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.endingFinancialAssets)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(r.netReleasedEquity)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(r.projectedNetEstate)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.success ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Funded</span>
                      ) : (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Depleted {r.firstDepletionYear}</span>
                      )}
                    </td>
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
