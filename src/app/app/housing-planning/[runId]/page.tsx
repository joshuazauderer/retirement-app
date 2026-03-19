'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type {
  HousingPlanningRunResult,
  HousingYearResult,
  EquityReleaseResult,
  LegacyProjectionResult,
} from '@/server/housing/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EquityReleasePanel({ er }: { er: EquityReleaseResult }) {
  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
      <h2 className="font-semibold text-slate-900">Equity Release Breakdown</h2>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Gross sale price</span>
          <span className="font-medium">{fmt(er.grossSalePrice)}</span>
        </div>
        <div className="flex justify-between text-red-600">
          <span>Selling costs ({((er.sellingCosts / er.grossSalePrice) * 100).toFixed(1)}%)</span>
          <span>-{fmt(er.sellingCosts)}</span>
        </div>
        <div className="flex justify-between text-red-600">
          <span>Mortgage payoff</span>
          <span>-{fmt(er.mortgagePayoff)}</span>
        </div>
        {er.replacementHomeCost > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Replacement home</span>
            <span>-{fmt(er.replacementHomeCost)}</span>
          </div>
        )}
        {er.oneTimeMoveCost > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Move costs</span>
            <span>-{fmt(er.oneTimeMoveCost)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t border-slate-100 pt-2 mt-2 text-green-700">
          <span>Net released equity</span>
          <span>{fmt(er.netReleasedEquity)}</span>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Net released equity enters your investable asset pool in the event year.
        Planning-grade estimate only. Not real-estate transaction advice.
      </p>
    </div>
  );
}

function LegacyPanel({ legacy }: { legacy: LegacyProjectionResult }) {
  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
      <h2 className="font-semibold text-slate-900">Legacy / Estate Projection ({legacy.projectionYear})</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Financial Assets" value={fmt(legacy.endingFinancialAssets)} />
        <StatCard label="Real Estate Equity" value={fmt(legacy.endingRealEstateEquity)} />
        <StatCard label="Liabilities" value={fmt(legacy.endingLiabilities)} />
        <StatCard label="Projected Net Estate" value={fmt(legacy.projectedNetEstate)} sub="Financial + RE - Liabilities" />
      </div>
      {legacy.totalLifetimeGifting > 0 && (
        <p className="text-sm text-slate-600">
          Total lifetime gifting: <strong>{fmt(legacy.totalLifetimeGifting)}</strong> — excluded from projected estate.
        </p>
      )}
      <p className="text-xs text-slate-400">{legacy.note}</p>
    </div>
  );
}

export default function HousingPlanningRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<HousingPlanningRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/housing-planning/${runId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setRun(d.run);
      })
      .catch(() => setError('Failed to load run.'))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading...</div>;
  if (error) return <div className="text-red-500 py-12 text-center">{error}</div>;
  if (!run) return null;

  const s = run.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{run.label}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {run.scenarioName} — {new Date(run.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Link href="/app/housing-planning">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        Planning estimates only. Not real-estate, tax, or legal advice.
      </div>

      {/* Status banner */}
      <div className={`rounded-xl p-4 border ${s.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
        <span className="font-semibold">
          {s.success ? 'Plan remains funded through the projection period.' : `Assets depleted in ${s.firstDepletionYear}.`}
        </span>
        {s.housingEventYear && (
          <span className="ml-2 text-sm">Housing event in {s.housingEventYear}.</span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Net Equity Released" value={fmt(s.netReleasedEquity)} sub={s.housingEventYear ? `In ${s.housingEventYear}` : 'No event'} />
        <StatCard label="Total Lifetime Housing Cost" value={fmt(s.totalLifetimeHousingCost)} />
        <StatCard label="Projected Net Estate" value={fmt(s.projectedNetEstate)} sub="Financial assets + RE equity" />
        <StatCard label="Ending Financial Assets" value={fmt(s.endingFinancialAssets)} />
        <StatCard label="Peak Annual Housing Cost" value={fmt(s.peakAnnualHousingCost)} />
        <StatCard label="Avg Annual Housing Cost" value={fmt(s.averageAnnualHousingCost)} />
        <StatCard label="Total Lifetime Gifting" value={fmt(s.totalLifetimeGifting)} />
        <StatCard label="Projection Period" value={`${s.projectionStartYear}–${s.projectionEndYear}`} sub={`${s.projectionEndYear - s.projectionStartYear + 1} years`} />
      </div>

      {/* Equity release */}
      {run.equityRelease && <EquityReleasePanel er={run.equityRelease} />}

      {/* Legacy projection */}
      {run.legacyProjection && <LegacyPanel legacy={run.legacyProjection} />}

      {/* Year-by-year table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Year-by-Year Projection</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Year</th>
                <th className="px-3 py-2 text-right">Age</th>
                <th className="px-3 py-2 text-right">Housing Cost</th>
                <th className="px-3 py-2 text-right">Equity Released</th>
                <th className="px-3 py-2 text-right">Gifting</th>
                <th className="px-3 py-2 text-right">Property Value</th>
                <th className="px-3 py-2 text-right">RE Equity</th>
                <th className="px-3 py-2 text-right">Ending Assets</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {run.yearByYear.map((yr: HousingYearResult) => (
                <tr
                  key={yr.year}
                  className={yr.depleted ? 'bg-red-50' : yr.housingEventOccurred ? 'bg-blue-50' : ''}
                >
                  <td className="px-3 py-2 font-medium">{yr.year}</td>
                  <td className="px-3 py-2 text-right">{yr.primaryAge}</td>
                  <td className="px-3 py-2 text-right">{fmt(yr.annualHousingCost)}</td>
                  <td className="px-3 py-2 text-right">
                    {yr.equityReleased > 0 ? (
                      <span className="text-green-700 font-medium">{fmt(yr.equityReleased)}</span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{yr.giftingAmount > 0 ? fmt(yr.giftingAmount) : '—'}</td>
                  <td className="px-3 py-2 text-right">{yr.estimatedPropertyValue > 0 ? fmt(yr.estimatedPropertyValue) : '—'}</td>
                  <td className="px-3 py-2 text-right">{fmt(yr.estimatedRealEstateEquity)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(yr.endingAssets)}</td>
                  <td className="px-3 py-2 text-center">
                    {yr.depleted ? (
                      <span className="text-xs text-red-600 font-medium">Depleted</span>
                    ) : yr.housingEventOccurred ? (
                      <span className="text-xs text-blue-600 font-medium">Housing Event</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
