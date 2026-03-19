'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HousingComparisonResult } from '@/server/housing/types';

function DirectionBadge({ direction }: { direction: 'better' | 'worse' | 'neutral' }) {
  if (direction === 'better') return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Better</span>;
  if (direction === 'worse') return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Worse</span>;
  return <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Neutral</span>;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const runA = searchParams.get('runA') ?? '';
  const runB = searchParams.get('runB') ?? '';
  const [comparison, setComparison] = useState<HousingComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runA || !runB) {
      setError('Both runA and runB are required.');
      setLoading(false);
      return;
    }
    fetch(`/api/housing-planning/compare?runA=${runA}&runB=${runB}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setComparison(d.comparison);
      })
      .catch(() => setError('Failed to load comparison.'))
      .finally(() => setLoading(false));
  }, [runA, runB]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading comparison...</div>;
  if (error) return <div className="text-red-500 py-12 text-center">{error}</div>;
  if (!comparison) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Housing Plan Comparison</h1>
          <p className="text-slate-500 text-sm mt-1">
            <strong>{comparison.runA.label}</strong> vs <strong>{comparison.runB.label}</strong>
          </p>
        </div>
        <Link href="/app/housing-planning">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        Planning estimates only. Not real-estate, tax, or legal advice.
      </div>

      {/* Config diffs */}
      {comparison.configDiffs.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Configuration Differences</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Setting</th>
                <th className="px-4 py-2 text-left">Run A</th>
                <th className="px-4 py-2 text-left">Run B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.configDiffs.map((d) => (
                <tr key={d.label}>
                  <td className="px-4 py-2 font-medium text-slate-700">{d.label}</td>
                  <td className="px-4 py-2">{d.a}</td>
                  <td className="px-4 py-2">{d.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outcome diffs */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Outcome Comparison</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Metric</th>
              <th className="px-4 py-2 text-right">Run A</th>
              <th className="px-4 py-2 text-right">Run B</th>
              <th className="px-4 py-2 text-right">Delta (B-A)</th>
              <th className="px-4 py-2 text-center">Direction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparison.outcomeDiffs.map((d) => (
              <tr key={d.label}>
                <td className="px-4 py-2 font-medium text-slate-700">{d.label}</td>
                <td className="px-4 py-2 text-right">{d.a}</td>
                <td className="px-4 py-2 text-right">{d.b}</td>
                <td className="px-4 py-2 text-right">{d.delta}</td>
                <td className="px-4 py-2 text-center"><DirectionBadge direction={d.direction} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Year-by-year housing cost delta */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Year-by-Year Housing Cost Delta</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Year</th>
                <th className="px-4 py-2 text-right">Run A Cost</th>
                <th className="px-4 py-2 text-right">Run B Cost</th>
                <th className="px-4 py-2 text-right">Delta (B-A)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.yearByYearDelta.map((yr) => (
                <tr key={yr.year} className={yr.delta < -100 ? 'bg-green-50' : yr.delta > 100 ? 'bg-red-50' : ''}>
                  <td className="px-4 py-2 font-medium">{yr.year}</td>
                  <td className="px-4 py-2 text-right">${Math.round(yr.housingCostA).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">${Math.round(yr.housingCostB).toLocaleString()}</td>
                  <td className={`px-4 py-2 text-right font-medium ${yr.delta < 0 ? 'text-green-700' : yr.delta > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    {yr.delta >= 0 ? '+' : ''}{Math.round(yr.delta).toLocaleString()}
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

export default function HousingComparisonPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 py-12 text-center">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
