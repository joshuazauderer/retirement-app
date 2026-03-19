'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { HealthcarePlanningSummaryItem } from '@/server/healthcare/types';

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function HealthcarePlanningPage() {
  const [runs, setRuns] = useState<HealthcarePlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runAId, setRunAId] = useState('');
  const [runBId, setRunBId] = useState('');
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    fetch('/api/healthcare-planning')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCompare = () => {
    if (runAId && runBId && runAId !== runBId) {
      setComparing(true);
      window.location.href = `/app/healthcare-planning/compare?runA=${runAId}&runB=${runBId}`;
    }
  };

  if (loading) {
    return <div className="text-slate-400 py-12 text-center">Loading healthcare planning runs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Healthcare Planning</h1>
          <p className="text-slate-500 text-sm mt-1">
            Model healthcare costs, Medicare transitions, LTC stress, and longevity scenarios.
          </p>
        </div>
        <Link href="/app/healthcare-planning/new">
          <Button>New Healthcare Analysis</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimates only.</strong> Not medical advice. Consult a healthcare planning
        specialist for personalized guidance.
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-500 mb-4">No healthcare planning runs yet.</p>
          <Link href="/app/healthcare-planning/new">
            <Button>Create Your First Analysis</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runs.map((run) => (
              <Link
                key={run.runId}
                href={`/app/healthcare-planning/${run.runId}`}
                className="block border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{run.label}</h3>
                    <p className="text-xs text-slate-400">{run.scenarioName}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      run.success
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {run.success ? 'Funded' : `Depleted ${run.firstDepletionYear}`}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Healthcare Cost</span>
                    <span className="font-medium">{fmt(run.totalHealthcareCost)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Ending Assets</span>
                    <span className="font-medium">{fmt(run.endingAssets)}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {run.hasLtcStress && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      LTC
                    </span>
                  )}
                  {run.hasLongevityStress && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                      Longevity to {run.longevityTargetAge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  {new Date(run.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>

          {/* A/B comparison */}
          {runs.length >= 2 && (
            <div className="border border-slate-200 rounded-xl p-5 bg-white">
              <h2 className="font-semibold text-slate-900 mb-4">Compare Two Runs</h2>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Run A</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={runAId}
                    onChange={(e) => setRunAId(e.target.value)}
                  >
                    <option value="">Select run A…</option>
                    {runs.map((r) => (
                      <option key={r.runId} value={r.runId}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Run B</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={runBId}
                    onChange={(e) => setRunBId(e.target.value)}
                  >
                    <option value="">Select run B…</option>
                    {runs.map((r) => (
                      <option key={r.runId} value={r.runId}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={handleCompare}
                  disabled={!runAId || !runBId || runAId === runBId || comparing}
                >
                  Compare →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
