'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/calculators/StatCard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function ScenarioDetailPage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = () =>
    fetch(`/api/scenarios/${scenarioId}`)
      .then(r => r.json())
      .then(d => { setScenario(d.scenario); setLoading(false); });

  useEffect(() => { load(); }, [scenarioId]);

  const run = async () => {
    setRunning(true);
    await fetch(`/api/scenarios/${scenarioId}/run`, { method: 'POST' });
    setRunning(false);
    load();
  };

  if (loading) return <div className="text-center py-16 text-slate-400">Loading...</div>;
  if (!scenario) return <div className="text-center py-16 text-slate-400">Not found.</div>;

  const simulationRuns = scenario.simulationRuns as Array<Record<string, unknown>> | undefined;
  const latestRun = simulationRuns?.[0];
  const overrides = scenario.overridesJson as Record<string, unknown> | null;
  const memberOverrides = overrides?.memberOverrides as Array<Record<string, unknown>> | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{scenario.name as string}</h1>
            {Boolean(scenario.isBaseline) && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                Baseline
              </span>
            )}
          </div>
          {scenario.description && (
            <p className="text-slate-500">{scenario.description as string}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            Type: {scenario.scenarioType as string} · Created{' '}
            {new Date(scenario.createdAt as string).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/app/scenarios/${scenarioId}/edit`)}>
            Edit
          </Button>
          <Button onClick={run} disabled={running}>
            {running ? 'Running...' : '▶ Run Projection'}
          </Button>
        </div>
      </div>

      {/* Overrides summary */}
      {overrides && Object.keys(overrides).length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Active Overrides</h3>
          <div className="space-y-1 text-sm">
            {memberOverrides?.map((mo) => (
              <div key={mo.memberId as string} className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">Retirement Age Override</span>
                <span className="font-medium">
                  {(mo.retirementAgeOverride ?? mo.lifeExpectancyOverride) as number}
                </span>
              </div>
            ))}
            {overrides.inflationRateOverride !== undefined && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">Inflation Rate</span>
                <span className="font-medium">
                  {((overrides.inflationRateOverride as number) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {overrides.expectedReturnOverride !== undefined && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">Expected Return</span>
                <span className="font-medium">
                  {((overrides.expectedReturnOverride as number) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {overrides.retirementDiscretionaryPctChange !== undefined && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">Discretionary Spending Change</span>
                <span className="font-medium">
                  {(overrides.retirementDiscretionaryPctChange as number) > 0 ? '+' : ''}
                  {((overrides.retirementDiscretionaryPctChange as number) * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {(overrides.additionalAnnualSavings as number) > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">Additional Annual Savings</span>
                <span className="font-medium">{fmt(overrides.additionalAnnualSavings as number)}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
          No overrides — this scenario uses baseline household data and assumptions.
        </div>
      )}

      {/* Latest run */}
      {latestRun ? (
        <div>
          <h3 className="font-semibold text-slate-800 mb-3">Latest Projection</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Status"
              value={latestRun.success ? 'Funded' : 'Depletes'}
              highlight={latestRun.success ? 'green' : 'red'}
            />
            <StatCard
              label="Ending Balance"
              value={fmt(Number(latestRun.endingBalance))}
            />
            <StatCard
              label="First Depletion"
              value={latestRun.firstDepletionYear?.toString() ?? 'None'}
              highlight={latestRun.firstDepletionYear ? 'red' : 'green'}
            />
            <StatCard
              label="Horizon"
              value={`${latestRun.projectionStartYear}–${latestRun.projectionEndYear}`}
            />
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
          No projection run yet. Click &ldquo;Run Projection&rdquo; to see results.
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/app/scenarios')}>
          ← Back to Scenarios
        </Button>
        <Button variant="outline" onClick={() => router.push(`/app/scenarios/compare?a=${scenarioId}`)}>
          Compare
        </Button>
      </div>
    </div>
  );
}
