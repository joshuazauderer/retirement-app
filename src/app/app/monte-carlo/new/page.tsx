'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MC_BOUNDS } from '@/server/monteCarlo/types';
import type { ScenarioSummary } from '@/server/scenarios/types';

export default function MonteCarloNewPage() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [simulationCount, setSimulationCount] = useState<number>(MC_BOUNDS.DEFAULT_SIMULATION_COUNT);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [randomizeSeed, setRandomizeSeed] = useState(true);
  const [volatilityPct, setVolatilityPct] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/scenarios')
      .then(r => r.json())
      .then(d => {
        const list: ScenarioSummary[] = d.scenarios ?? [];
        setScenarios(list);
        const baseline = list.find(s => s.isBaseline);
        if (baseline) setScenarioId(baseline.id);
      });
  }, []);

  const handleRun = async () => {
    if (!scenarioId) { setError('Please select a scenario.'); return; }
    setRunning(true); setError(null);

    const effectiveSeed = randomizeSeed ? Math.floor(Math.random() * 2 ** 31) : seed;
    const body: Record<string, unknown> = {
      scenarioId,
      simulationCount,
      seed: effectiveSeed,
    };
    if (volatilityPct !== '') body.volatilityOverride = parseFloat(volatilityPct) / 100;

    try {
      const res = await fetch('/api/monte-carlo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to run simulation.'); return; }
      router.push(`/app/monte-carlo/${data.run.runId}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Monte Carlo Simulation</h1>
        <p className="text-slate-500 mt-1">
          Run thousands of randomized market scenarios to estimate the probability that
          your retirement plan succeeds.
        </p>
      </div>

      {/* Model note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Model note:</strong> This simulation uses independent annual return draws
        from a normal distribution (mean = planning assumptions expected return, std = volatility).
        Inflation is held deterministic. This is a v1 approximation.
      </div>

      <div className="space-y-4">
        {/* Scenario */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Scenario</label>
          <select
            value={scenarioId}
            onChange={e => setScenarioId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a scenario...</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isBaseline ? ' (Baseline)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Simulation count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Number of Paths ({MC_BOUNDS.MIN_SIMULATION_COUNT}–{MC_BOUNDS.MAX_SIMULATION_COUNT})
          </label>
          <input
            type="number"
            min={MC_BOUNDS.MIN_SIMULATION_COUNT}
            max={MC_BOUNDS.MAX_SIMULATION_COUNT}
            step={100}
            value={simulationCount}
            onChange={e => setSimulationCount(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            More paths increase precision but take longer. 1,000 is recommended.
          </p>
        </div>

        {/* Volatility override */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Volatility Override (%)  <span className="text-slate-400 font-normal">optional</span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={volatilityPct}
            onChange={e => setVolatilityPct(e.target.value)}
            placeholder="Default: 12% from planning assumptions"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Seed */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="randomizeSeed"
              checked={randomizeSeed}
              onChange={e => setRandomizeSeed(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="randomizeSeed" className="text-sm text-slate-700">
              Randomize seed (recommended)
            </label>
          </div>
          {!randomizeSeed && (
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value))}
              placeholder="Enter seed for reproducibility"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <p className="text-xs text-slate-400 mt-1">
            Fix the seed to reproduce the exact same simulation later.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleRun} disabled={running || !scenarioId}>
          {running ? 'Running simulation...' : '▶ Run Monte Carlo'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/app/monte-carlo')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
