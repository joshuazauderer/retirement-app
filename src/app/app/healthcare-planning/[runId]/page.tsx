'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HealthcarePlanningRunResult, HealthcareYearResult } from '@/server/healthcare/types';

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

export default function HealthcarePlanningRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<HealthcarePlanningRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) return;
    fetch(`/api/healthcare-planning/${runId}`)
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
        <Link href="/app/healthcare-planning">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        Planning estimates only. Not medical advice. Consult a healthcare planning specialist.
      </div>

      {/* Status banner */}
      <div
        className={`rounded-xl p-4 border ${
          s.success
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}
      >
        <span className="font-semibold">
          {s.success
            ? 'Plan remains funded through the projection period.'
            : `Assets depleted in ${s.firstDepletionYear}.`}
        </span>
        {s.longevityExtensionYears > 0 && (
          <span className="ml-2 text-sm">
            (Timeline extended by {s.longevityExtensionYears} years for longevity stress.)
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Healthcare Cost" value={fmt(s.totalHealthcareCost)} />
        <StatCard label="Pre-Medicare Cost" value={fmt(s.totalPreMedicareCost)} />
        <StatCard label="Medicare Cost" value={fmt(s.totalMedicareCost)} />
        <StatCard
          label="Long-Term Care Cost"
          value={fmt(s.totalLtcCost)}
          sub={s.totalLtcCost > 0 ? 'LTC stress active' : 'No LTC stress'}
        />
        <StatCard
          label="Peak Annual Cost"
          value={fmt(s.peakAnnualHealthcareCost)}
          sub={`In ${s.peakHealthcareCostYear}`}
        />
        <StatCard
          label="Average Annual Cost"
          value={fmt(s.averageAnnualHealthcareCost)}
        />
        <StatCard label="Ending Assets" value={fmt(s.endingAssets)} />
        <StatCard
          label="Projection Period"
          value={`${s.projectionStartYear}–${s.projectionEndYear}`}
          sub={`${s.projectionEndYear - s.projectionStartYear + 1} years`}
        />
      </div>

      {/* Year-by-year table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Year-by-Year Projection</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Year</th>
                <th className="px-4 py-2 text-right">Age</th>
                <th className="px-4 py-2 text-right">Sp. Age</th>
                <th className="px-4 py-2 text-right">Pre-Medicare</th>
                <th className="px-4 py-2 text-right">Medicare</th>
                <th className="px-4 py-2 text-right">Sp. Pre-Medicare</th>
                <th className="px-4 py-2 text-right">Sp. Medicare</th>
                <th className="px-4 py-2 text-right">LTC</th>
                <th className="px-4 py-2 text-right">Total Cost</th>
                <th className="px-4 py-2 text-right">Ending Assets</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {run.yearByYear.map((yr: HealthcareYearResult) => (
                <tr
                  key={yr.year}
                  className={yr.depleted ? 'bg-red-50' : yr.ltcActive ? 'bg-orange-50' : ''}
                >
                  <td className="px-4 py-2 font-medium">{yr.year}</td>
                  <td className="px-4 py-2 text-right">{yr.age}</td>
                  <td className="px-4 py-2 text-right">{yr.spouseAge ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{fmt(yr.primaryPreMedicareCost)}</td>
                  <td className="px-4 py-2 text-right">{fmt(yr.primaryMedicareCost)}</td>
                  <td className="px-4 py-2 text-right">{fmt(yr.spousePreMedicareCost)}</td>
                  <td className="px-4 py-2 text-right">{fmt(yr.spouseMedicareCost)}</td>
                  <td className="px-4 py-2 text-right">{yr.ltcCost > 0 ? fmt(yr.ltcCost) : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(yr.totalHealthcareCost)}</td>
                  <td className="px-4 py-2 text-right">{fmt(yr.endingAssets)}</td>
                  <td className="px-4 py-2 text-center">
                    {yr.depleted ? (
                      <span className="text-xs text-red-600 font-medium">Depleted</span>
                    ) : yr.ltcActive ? (
                      <span className="text-xs text-orange-600 font-medium">LTC Active</span>
                    ) : yr.primaryOnMedicare ? (
                      <span className="text-xs text-blue-600">Medicare</span>
                    ) : (
                      <span className="text-xs text-slate-400">Pre-Medicare</span>
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
