'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { TaxComparisonResult } from '@/server/tax/types';

function DirectionIcon({ direction }: { direction: 'better' | 'worse' | 'neutral' }) {
  if (direction === 'better') return <span className="text-green-600 font-bold">↑</span>;
  if (direction === 'worse') return <span className="text-red-600 font-bold">↓</span>;
  return <span className="text-slate-400">→</span>;
}

function fmt(n: number) { return `$${Math.round(Math.abs(n)).toLocaleString()}`; }

function CompareContent() {
  const searchParams = useSearchParams();
  const runAId = searchParams.get('runA') ?? '';
  const runBId = searchParams.get('runB') ?? '';
  const [comparison, setComparison] = useState<TaxComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runAId || !runBId) { setError('Missing runA or runB.'); setLoading(false); return; }
    fetch(`/api/tax-planning/compare?runA=${runAId}&runB=${runBId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setComparison(d.comparison); })
      .catch(() => setError('Failed to load comparison.'))
      .finally(() => setLoading(false));
  }, [runAId, runBId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading comparison…</div>;
  if (error || !comparison) return (
    <div className="text-red-600 py-12 text-center">
      {error || 'Failed to load comparison.'}
      <div className="mt-4"><Link href="/app/tax-planning"><Button variant="outline">Back</Button></Link></div>
    </div>
  );

  const { runA, runB } = comparison;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tax Strategy Comparison</h1>
          <p className="text-slate-500 text-sm mt-1">
            <span className="font-medium text-slate-700">A:</span> {runA.label} ·{' '}
            <span className="font-medium text-slate-700">B:</span> {runB.label}
          </p>
        </div>
        <Link href="/app/tax-planning"><Button variant="outline" size="sm">← Back</Button></Link>
      </div>

      {comparison.configDiffs.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Configuration Differences</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-slate-500">Setting</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500">Run A</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500">Run B</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.configDiffs.map((d, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-slate-900">{d.label}</td>
                  <td className="px-4 py-3 text-center text-xs">{d.a}</td>
                  <td className="px-4 py-3 text-center text-xs">{d.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Outcome Comparison</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs text-slate-500">Metric</th>
              <th className="px-4 py-2 text-center text-xs text-slate-500">Run A</th>
              <th className="px-4 py-2 text-center text-xs text-slate-500">Run B</th>
              <th className="px-4 py-2 text-center text-xs text-slate-500">Delta</th>
              <th className="px-4 py-2 text-center text-xs text-slate-500">Direction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comparison.outcomeDiffs.map((d, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{d.label}</td>
                <td className="px-4 py-3 text-center font-mono text-xs text-slate-600">{d.a}</td>
                <td className="px-4 py-3 text-center font-mono text-xs text-slate-600">{d.b}</td>
                <td className="px-4 py-3 text-center font-mono text-xs font-medium">
                  <span className={
                    d.direction === 'better' ? 'text-green-700' :
                    d.direction === 'worse' ? 'text-red-700' : 'text-slate-500'
                  }>{d.delta}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <DirectionIcon direction={d.direction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {comparison.yearByYearDelta.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Annual Tax Difference (B − A)</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Year</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Run A Tax</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Run B Tax</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparison.yearByYearDelta.slice(0, 50).map((y) => (
                  <tr key={y.year} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono">{y.year}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(y.totalTaxA)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(y.totalTaxB)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-medium ${y.delta > 50 ? 'text-red-600' : y.delta < -50 ? 'text-green-600' : 'text-slate-500'}`}>
                      {y.delta > 0 ? '+' : ''}{fmt(y.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        Planning estimates only. ↑ = Run B is better for this metric. Not tax preparation software.
      </div>
    </div>
  );
}

export default function TaxCompare() {
  return (
    <Suspense fallback={<div className="text-slate-400 py-12 text-center">Loading…</div>}>
      <CompareContent />
    </Suspense>
  );
}
