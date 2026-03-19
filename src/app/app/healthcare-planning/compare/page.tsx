'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HealthcareComparisonResult } from '@/server/healthcare/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function directionBadge(direction: 'better' | 'worse' | 'neutral') {
  if (direction === 'better') {
    return (
      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
        Better
      </span>
    );
  }
  if (direction === 'worse') {
    return (
      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
        Worse
      </span>
    );
  }
  return (
    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
      Neutral
    </span>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const runAId = searchParams.get('runA');
  const runBId = searchParams.get('runB');

  const [comparison, setComparison] = useState<HealthcareComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runAId || !runBId) {
      setError('Missing runA or runB query parameters.');
      setLoading(false);
      return;
    }

    fetch(`/api/healthcare-planning/compare?runA=${runAId}&runB=${runBId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setComparison(d.comparison);
      })
      .catch(() => setError('Failed to load comparison.'))
      .finally(() => setLoading(false));
  }, [runAId, runBId]);

  if (loading) {
    return <div className="text-slate-400 py-12 text-center">Loading comparison...</div>;
  }
  if (error) {
    return <div className="text-red-500 py-12 text-center">{error}</div>;
  }
  if (!comparison) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Healthcare Plan Comparison</h1>
          <p className="text-slate-500 text-sm mt-1">
            <span className="font-medium text-slate-700">{comparison.runA.label}</span>
            {' vs '}
            <span className="font-medium text-slate-700">{comparison.runB.label}</span>
          </p>
        </div>
        <Link href="/app/healthcare-planning">
          <Button variant="outline" size="sm">← Back to Healthcare Planning</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        Planning estimates only. Not medical advice. Consult a healthcare planning specialist.
      </div>

      {/* Config diffs */}
      {comparison.configDiffs.length > 0 && (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Configuration Differences</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Settings that differ between the two runs.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left">Setting</th>
                <th className="px-5 py-2 text-left">Run A — {comparison.runA.label}</th>
                <th className="px-5 py-2 text-left">Run B — {comparison.runB.label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.configDiffs.map((diff) => (
                <tr key={diff.label}>
                  <td className="px-5 py-3 font-medium text-slate-700">{diff.label}</td>
                  <td className="px-5 py-3 text-slate-600">{diff.a}</td>
                  <td className="px-5 py-3 text-slate-600">{diff.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {comparison.configDiffs.length === 0 && (
        <div className="border border-slate-200 rounded-xl p-5 bg-white text-sm text-slate-500">
          No configuration differences detected. These runs use the same settings.
        </div>
      )}

      {/* Outcome diffs */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Outcome Comparison</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direction (Better/Worse) is from Run A&rsquo;s perspective relative to Run B.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-2 text-left">Metric</th>
              <th className="px-5 py-2 text-right">Run A</th>
              <th className="px-5 py-2 text-right">Run B</th>
              <th className="px-5 py-2 text-right">Delta (B - A)</th>
              <th className="px-5 py-2 text-center">Direction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparison.outcomeDiffs.map((diff) => (
              <tr key={diff.label}>
                <td className="px-5 py-3 font-medium text-slate-700">{diff.label}</td>
                <td className="px-5 py-3 text-right text-slate-600">{diff.a}</td>
                <td className="px-5 py-3 text-right text-slate-600">{diff.b}</td>
                <td className="px-5 py-3 text-right font-medium text-slate-700">{diff.delta}</td>
                <td className="px-5 py-3 text-center">{directionBadge(diff.direction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Year-by-year delta table */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Year-by-Year Cost Delta</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Annual total healthcare cost for each run and the difference (Run B minus Run A).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left">Year</th>
                <th className="px-5 py-2 text-right">Run A Cost</th>
                <th className="px-5 py-2 text-right">Run B Cost</th>
                <th className="px-5 py-2 text-right">Delta (B - A)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.yearByYearDelta.map((yr) => (
                <tr
                  key={yr.year}
                  className={yr.delta > 0 ? 'bg-red-50' : yr.delta < 0 ? 'bg-green-50' : ''}
                >
                  <td className="px-5 py-2 font-medium">{yr.year}</td>
                  <td className="px-5 py-2 text-right text-slate-600">{fmt(yr.costA)}</td>
                  <td className="px-5 py-2 text-right text-slate-600">{fmt(yr.costB)}</td>
                  <td
                    className={`px-5 py-2 text-right font-medium ${
                      yr.delta > 0
                        ? 'text-red-600'
                        : yr.delta < 0
                          ? 'text-green-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {yr.delta >= 0 ? '+' : ''}
                    {fmt(yr.delta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigation links */}
      <div className="flex gap-3">
        <Link href={`/app/healthcare-planning/${runAId}`}>
          <Button variant="outline" size="sm">View Run A Detail</Button>
        </Link>
        <Link href={`/app/healthcare-planning/${runBId}`}>
          <Button variant="outline" size="sm">View Run B Detail</Button>
        </Link>
      </div>
    </div>
  );
}

export default function HealthcareComparePage() {
  return (
    <Suspense fallback={<div className="text-slate-400 py-12 text-center">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
