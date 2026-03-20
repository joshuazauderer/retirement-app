'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { MonteCarloListItem } from '@/server/monteCarlo/types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function MonteCarloListPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<MonteCarloListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  useEffect(() => {
    fetch('/api/monte-carlo')
      .then(async r => {
        const d = await r.json();
        if (r.status === 402 || d.upgradeRequired) {
          setUpgradeRequired(true);
        } else {
          setRuns(d.runs ?? []);
        }
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading...</div>;

  if (upgradeRequired) return (
    <div className="max-w-lg mx-auto mt-20 text-center space-y-4">
      <div className="text-4xl">🔒</div>
      <h2 className="text-2xl font-bold text-slate-900">Pro Feature</h2>
      <p className="text-slate-500">Monte Carlo simulations require a Pro or Advisor subscription.</p>
      <a href="/app/settings/billing" className="inline-block mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
        Upgrade to Pro
      </a>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monte Carlo Simulations</h1>
          <p className="text-slate-500 mt-1">
            Probability-based retirement plan analysis across thousands of market scenarios.
          </p>
        </div>
        <Button onClick={() => router.push('/app/monte-carlo/new')}>
          + New Simulation
        </Button>
      </div>

      {runs.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-500 mb-4">No Monte Carlo simulations yet.</p>
          <p className="text-sm text-slate-400 mb-6">
            Run a probability analysis to see how likely your retirement plan is to succeed
            across thousands of possible market scenarios.
          </p>
          <Button onClick={() => router.push('/app/monte-carlo/new')}>
            Run First Simulation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.length >= 2 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => router.push(`/app/monte-carlo/compare?a=${runs[0].runId}&b=${runs[1].runId}`)}
              >
                Compare Runs
              </Button>
            </div>
          )}

          {runs.map(run => {
            const successColor =
              run.successProbability >= 0.85
                ? 'text-green-700 bg-green-50'
                : run.successProbability >= 0.7
                ? 'text-yellow-700 bg-yellow-50'
                : 'text-red-700 bg-red-50';

            return (
              <div
                key={run.runId}
                className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors"
                onClick={() => router.push(`/app/monte-carlo/${run.runId}`)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">
                      {run.label ?? run.scenarioName}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${successColor}`}>
                      {pct(run.successProbability)} success
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {run.simulationCount.toLocaleString()} paths · seed {run.seed} ·{' '}
                    {run.projectionStartYear}–{run.projectionEndYear} ·{' '}
                    {new Date(run.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-900">
                    {fmt(run.medianEndingAssets)}
                  </div>
                  <div className="text-xs text-slate-400">median ending assets</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
