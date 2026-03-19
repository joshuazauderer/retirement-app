'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HousingPlanningSummaryItem } from '@/server/housing/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function DownsizingPage() {
  const [runs, setRuns] = useState<HousingPlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/downsizing')
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
          <h1 className="text-2xl font-bold text-slate-900">Downsizing</h1>
          <p className="text-slate-500 text-sm mt-1">
            How selling your home and moving to a smaller one affects your retirement plan.
          </p>
        </div>
        <Link href="/app/housing-planning/new">
          <Button>+ New Downsizing Analysis</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <strong>Planning estimates only.</strong> Not real-estate transaction advice. Equity release figures are planning approximations.
        Mortgage amortization uses a simplified model. Consult a real-estate professional before making any transaction decisions.
      </div>

      {/* Educational content */}
      <div className="border border-slate-200 rounded-xl p-6 bg-white space-y-4">
        <h2 className="font-semibold text-slate-900 text-lg">How Downsizing Affects Retirement</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Equity Release</h3>
            <p>
              Selling a larger home and buying a smaller one (or renting) can release significant home equity
              into your investable asset pool — potentially extending how long your retirement funds last.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Reduced Housing Costs</h3>
            <p>
              Smaller homes typically mean lower property taxes, insurance, and maintenance costs.
              Eliminating a mortgage entirely can dramatically improve retirement cash flow.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Selling Costs (Planning Assumption: ~6%)</h3>
            <p>
              Agent commissions, title, escrow, and other closing costs typically total 5–8% of sale price.
              This tool uses 6% as a planning default — adjust based on your market.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-slate-800">Timing Considerations</h3>
            <p>
              Earlier downsizing releases equity sooner — allowing more years of investment growth.
              Later downsizing may reduce housing costs during peak retirement spending years.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <h3 className="font-medium text-slate-800 text-sm mb-2">National Context (Planning Reference — Not Investment Advice)</h3>
          <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
            <li>Median home equity for homeowners age 65+ was approximately $250,000 (Federal Reserve SCF, recent years)</li>
            <li>Typical selling costs: 5–8% of gross sale price</li>
            <li>National median home price appreciation: ~3–4% annually (historical long-term average)</li>
            <li>Moving costs vary significantly by distance and household size ($5,000–$20,000+ nationally)</li>
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            These figures are general reference values for planning context only.
            Actual values vary significantly by market, property, and circumstances.
          </p>
        </div>
      </div>

      {/* Downsizing runs */}
      {loading ? (
        <div className="text-slate-400 py-12 text-center">Loading analyses...</div>
      ) : error ? (
        <div className="text-red-500 py-4">{error}</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
          <p className="text-lg font-medium mb-2">No downsizing analyses yet</p>
          <p className="text-sm mb-4">Create a housing analysis with the Downsize strategy to see results here.</p>
          <Link href="/app/housing-planning/new">
            <Button>Create Downsizing Analysis</Button>
          </Link>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Your Downsizing Analyses</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-right">Net Equity Released</th>
                <th className="px-4 py-3 text-right">Ending Assets</th>
                <th className="px-4 py-3 text-right">Projected Estate</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr key={r.runId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(r.netReleasedEquity)}</td>
                  <td className="px-4 py-3 text-right">{fmt(r.endingFinancialAssets)}</td>
                  <td className="px-4 py-3 text-right">{fmt(r.projectedNetEstate)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.success ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Funded</span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Depleted {r.firstDepletionYear}</span>
                    )}
                  </td>
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
      )}
    </div>
  );
}
