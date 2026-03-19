'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { SocialSecurityRunSummaryItem } from '@/server/socialSecurity/types';

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function SocialSecurityIndexPage() {
  const [runs, setRuns] = useState<SocialSecurityRunSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  useEffect(() => {
    fetch('/api/social-security')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const canCompare = compareA && compareB && compareA !== compareB;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Social Security Planning</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Model different claim ages, view COLA-adjusted lifetime benefits, and analyze couple
            coordination and survivor income.
          </p>
        </div>
        <Link href="/app/social-security/new">
          <Button>+ New Analysis</Button>
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Planning-grade model:</strong> FRA fixed at 67 (born 1960+). Annual time-step.
        Adjustment rates are approximate (5/9% / 5/12% early; 2/3% per month late). No WEP,
        GPO, spousal benefit, or deemed filing. Results are for educational planning use only.
      </div>

      {loading ? (
        <div className="text-slate-400 py-8 text-center text-sm">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-slate-400 text-sm">No SS analyses yet.</p>
          <Link href="/app/social-security/new" className="mt-3 inline-block">
            <Button size="sm">Run your first analysis</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Label</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Scenario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Claim Ages</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Lifetime Benefit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Compare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <tr key={r.runId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/social-security/${r.runId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {r.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.scenarioName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {Object.values(r.claimAges).map((age, i) => (
                        <span key={i} className="mr-2">age {age}</span>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                      {fmt(r.totalLifetimeBenefit)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <label className="text-xs text-slate-400">
                          <input
                            type="radio"
                            name="compareA"
                            value={r.runId}
                            checked={compareA === r.runId}
                            onChange={() => setCompareA(r.runId)}
                            className="mr-1"
                          />
                          A
                        </label>
                        <label className="text-xs text-slate-400">
                          <input
                            type="radio"
                            name="compareB"
                            value={r.runId}
                            checked={compareB === r.runId}
                            onChange={() => setCompareB(r.runId)}
                            className="mr-1"
                          />
                          B
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canCompare && (
            <div className="flex justify-end">
              <Link href={`/app/social-security/compare?runA=${compareA}&runB=${compareB}`}>
                <Button variant="outline">Compare Selected</Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
