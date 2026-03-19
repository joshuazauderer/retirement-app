'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { TaxPlanningSummaryItem } from '@/server/tax/types';

function fmt(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default function TaxPlanningPage() {
  const [runs, setRuns] = useState<TaxPlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedA, setSelectedA] = useState('');
  const [selectedB, setSelectedB] = useState('');

  useEffect(() => {
    fetch('/api/tax-planning')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const compareUrl =
    selectedA && selectedB && selectedA !== selectedB
      ? `/app/tax-planning/compare?runA=${selectedA}&runB=${selectedB}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tax Planning</h1>
          <p className="text-slate-500 text-sm mt-1">
            Tax-aware retirement projections with bracket-based federal + state tax estimates.
          </p>
        </div>
        <Link href="/app/tax-planning/new">
          <Button>+ New Tax Analysis</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimates only.</strong> This tool uses planning-grade federal brackets
        (2024 base), simplified state effective rates, and approximated capital gains and Social
        Security taxation. Not tax preparation software. Consult a CPA or tax advisor for filing guidance.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/app/tax-planning/new" className="block rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:bg-blue-50 transition-colors">
          <div className="text-2xl mb-2">📊</div>
          <div className="font-semibold text-slate-900">Tax-Aware Projection</div>
          <div className="text-sm text-slate-500 mt-1">
            Run a full retirement projection with bracket-based taxes.
          </div>
        </Link>
        <Link href="/app/roth-conversions" className="block rounded-xl border border-slate-200 p-5 hover:border-purple-300 hover:bg-purple-50 transition-colors">
          <div className="text-2xl mb-2">🔄</div>
          <div className="font-semibold text-slate-900">Roth Conversions</div>
          <div className="text-sm text-slate-500 mt-1">
            Model Roth conversion what-ifs and see tax impact.
          </div>
        </Link>
        <div className="block rounded-xl border border-slate-200 p-5 bg-slate-50">
          <div className="text-2xl mb-2">⚖️</div>
          <div className="font-semibold text-slate-900">Compare Strategies</div>
          <div className="text-sm text-slate-500 mt-1">
            Select two runs below with A/B to compare.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 py-8 text-center">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">🧾</div>
          <div className="font-medium text-slate-600">No tax analyses yet.</div>
          <div className="text-sm mt-1">Run your first tax-aware projection to see results here.</div>
          <Link href="/app/tax-planning/new" className="mt-4 inline-block">
            <Button>+ New Tax Analysis</Button>
          </Link>
        </div>
      ) : (
        <>
          {compareUrl && (
            <div className="flex justify-end">
              <Link href={compareUrl}>
                <Button variant="outline">Compare A vs B →</Button>
              </Link>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 w-8">A</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 w-8">B</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Scenario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Filing / State</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Lifetime Tax</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Federal</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">State</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Ending Assets</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Roth</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <tr key={r.runId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name="runA"
                        checked={selectedA === r.runId}
                        onChange={() => setSelectedA(r.runId)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name="runB"
                        checked={selectedB === r.runId}
                        onChange={() => setSelectedB(r.runId)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/app/tax-planning/${r.runId}`} className="text-blue-600 hover:underline font-medium">
                        {r.label}
                      </Link>
                      <div className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{r.scenarioName}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{r.filingStatus.replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{r.stateOfResidence}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-medium">{fmt(r.totalLifetimeTax)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(r.totalFederalTax)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(r.totalStateTax)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(r.endingAssets)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.hasRothConversion ? (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Yes</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.success ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Funded</span>
                      ) : (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Depleted {r.firstDepletionYear}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        Federal brackets: 2024 base, inflated forward by assumed rate. State rates: simplified flat effective rates.
        SS taxation: provisional income method. Capital gains: basis-ratio approximation. Not SSA- or IRS-certified.
      </div>
    </div>
  );
}
