'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { SocialSecurityClaimComparisonResult } from '@/server/socialSecurity/types';

function DirectionIcon({ direction }: { direction: 'better' | 'worse' | 'neutral' }) {
  if (direction === 'better') return <span className="text-green-600 font-bold">↑</span>;
  if (direction === 'worse') return <span className="text-red-600 font-bold">↓</span>;
  return <span className="text-slate-400">→</span>;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const runAId = searchParams.get('runA') ?? '';
  const runBId = searchParams.get('runB') ?? '';

  const [comparison, setComparison] = useState<SocialSecurityClaimComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runAId || !runBId) { setError('Missing runA or runB.'); setLoading(false); return; }
    fetch(`/api/social-security/compare?runA=${runAId}&runB=${runBId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setComparison(d.comparison);
      })
      .catch(() => setError('Failed to load comparison.'))
      .finally(() => setLoading(false));
  }, [runAId, runBId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading comparison...</div>;
  if (error || !comparison) return (
    <div className="text-red-600 py-12 text-center">
      {error ?? 'Failed to load comparison.'}
      <div className="mt-4"><Link href="/app/social-security"><Button variant="outline">Back</Button></Link></div>
    </div>
  );

  const { runA, runB } = comparison;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SS Claim Strategy Comparison</h1>
          <p className="text-slate-500 text-sm mt-1">
            <span className="font-medium text-slate-700">A:</span> {runA.label} ·{' '}
            <span className="font-medium text-slate-700">B:</span> {runB.label}
          </p>
        </div>
        <Link href="/app/social-security">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      {/* Claim age diffs */}
      {comparison.claimAgeDiffs.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Claim Age Differences</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-slate-500">Member</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500">Run A Claim Age</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500">Run A Adjustment</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500">Run B Claim Age</th>
                <th className="px-4 py-2 text-center text-xs text-slate-500">Run B Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparison.claimAgeDiffs.map((diff) => (
                <tr key={diff.memberId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{diff.firstName}</td>
                  <td className="px-4 py-3 text-center">{diff.claimAgeA}</td>
                  <td className="px-4 py-3 text-center text-xs">
                    {(diff.adjustmentFactorA * 100 - 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">{diff.claimAgeB}</td>
                  <td className="px-4 py-3 text-center text-xs">
                    {(diff.adjustmentFactorB * 100 - 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outcome diffs */}
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
            {comparison.outcomeDiffs.map((diff, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{diff.label}</td>
                <td className="px-4 py-3 text-center font-mono text-xs text-slate-600">{diff.a}</td>
                <td className="px-4 py-3 text-center font-mono text-xs text-slate-600">{diff.b}</td>
                <td className="px-4 py-3 text-center font-mono text-xs font-medium">
                  <span className={
                    diff.direction === 'better' ? 'text-green-700' :
                    diff.direction === 'worse' ? 'text-red-700' : 'text-slate-500'
                  }>{diff.delta}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <DirectionIcon direction={diff.direction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        Planning-grade model. FRA = 67. Annual time-step. Not SSA-certified.
        "Direction" reflects Run B vs. Run A — ↑ = Run B is better for this metric.
      </div>
    </div>
  );
}

export default function SocialSecurityComparePage() {
  return (
    <Suspense fallback={<div className="text-slate-400 py-12 text-center">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
