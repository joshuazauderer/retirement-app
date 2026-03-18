'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/calculators/StatCard';
import { BandChart } from '@/components/monteCarlo/BandChart';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function pct(n: number, d = 1) {
  return `${(n * 100).toFixed(d)}%`;
}

function SuccessGauge({ probability }: { probability: number }) {
  const pctNum = Math.round(probability * 100);
  const color =
    probability >= 0.85 ? '#16a34a' : probability >= 0.70 ? '#ca8a04' : '#dc2626';
  const label =
    probability >= 0.85 ? 'Strong' : probability >= 0.70 ? 'Moderate' : 'At Risk';

  return (
    <div className="flex flex-col items-center py-4">
      <svg viewBox="0 0 120 70" className="w-40">
        <path d="M 10 65 A 55 55 0 0 1 110 65" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M 10 65 A 55 55 0 0 1 110 65"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${172.8 * probability} 172.8`}
        />
        <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>
          {pctNum}%
        </text>
      </svg>
      <span className="text-sm font-semibold mt-1" style={{ color }}>{label}</span>
      <span className="text-xs text-slate-400">probability of success</span>
    </div>
  );
}

export default function MonteCarloResultPage() {
  const { runId } = useParams<{ runId: string }>();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/monte-carlo/${runId}`)
      .then(r => r.json())
      .then(d => { setRun(d.run); setLoading(false); });
  }, [runId]);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading...</div>;
  if (!run) return <div className="text-center py-16 text-slate-400">Simulation not found.</div>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agg = run.aggregation as any;
  const success = agg.success;
  const endingAssets = agg.endingAssets;
  const assumptions = run.assumptions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{run.scenarioName}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {run.simulationCount.toLocaleString()} simulated paths · seed {run.seed} ·{' '}
            {agg.projectionStartYear}–{agg.projectionEndYear} ·{' '}
            {new Date(run.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/app/monte-carlo/compare?a=' + runId)}>
            Compare
          </Button>
          <Button onClick={() => router.push('/app/monte-carlo/new')}>
            New Simulation
          </Button>
        </div>
      </div>

      {/* Success gauge + key stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-center">
          <SuccessGauge probability={success.successProbability} />
        </div>
        <div className="md:col-span-3 grid grid-cols-3 gap-3">
          <StatCard
            label="Success Rate"
            value={pct(success.successProbability)}
            highlight={success.successProbability >= 0.85 ? 'green' : success.successProbability >= 0.70 ? undefined : 'red'}
          />
          <StatCard label="Median Ending Assets" value={fmt(endingAssets.p50)} />
          <StatCard
            label="Depletion Probability"
            value={pct(success.failureProbability)}
            highlight={success.failureProbability <= 0.15 ? 'green' : 'red'}
          />
          <StatCard label="Worst 10% Ending" value={fmt(endingAssets.p10)} />
          <StatCard label="Best 10% Ending" value={fmt(endingAssets.p90)} />
          <StatCard
            label="Median Depletion Year"
            value={success.medianDepletionYear?.toString() ?? 'None'}
            highlight={success.medianDepletionYear ? 'red' : 'green'}
          />
        </div>
      </div>

      {/* Balance band chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Portfolio Balance — Probability Bands</h3>
        <p className="text-xs text-slate-400 mb-4">
          Shows the range of outcomes across all {run.simulationCount.toLocaleString()} simulated market paths.
        </p>
        <BandChart bands={agg.balanceBands} />
      </div>

      {/* Depletion risk panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Depletion Risk by Age</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Before Age 85', value: success.depletionBeforeAge85Probability },
            { label: 'Before Age 90', value: success.depletionBeforeAge90Probability },
            { label: 'Before Age 95', value: success.depletionBeforeAge95Probability },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-3 bg-slate-50 rounded-lg">
              <div
                className={`text-2xl font-bold ${value > 0.15 ? 'text-red-600' : value > 0.05 ? 'text-yellow-600' : 'text-green-600'}`}
              >
                {pct(value)}
              </div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Percentile outcome table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Ending Asset Distribution</h3>
        <div className="divide-y divide-slate-100">
          {[
            { label: 'P10 — Poor markets (worst 10%)', value: endingAssets.p10 },
            { label: 'P25 — Below average markets', value: endingAssets.p25 },
            { label: 'P50 — Median outcome', value: endingAssets.p50 },
            { label: 'P75 — Above average markets', value: endingAssets.p75 },
            { label: 'P90 — Strong markets (best 10%)', value: endingAssets.p90 },
            { label: 'Average across all paths', value: endingAssets.mean },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2 text-sm">
              <span className="text-slate-600">{label}</span>
              <span className={`font-medium ${value < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {fmt(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Assumptions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Simulation Assumptions</h3>
        <div className="divide-y divide-slate-100">
          {[
            ['Mean Annual Return', pct(assumptions.meanReturn)],
            ['Annual Volatility (Std Dev)', pct(assumptions.volatility)],
            ['Inflation Rate', pct(assumptions.inflationRate)],
            ['Effective Tax Rate', pct(assumptions.taxRate)],
            ['Simulation Count', run.simulationCount.toLocaleString()],
            ['Random Seed', String(run.seed)],
            ['Engine Version', run.engineVersion],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 text-sm">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-slate-900">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Returns are drawn independently from a normal distribution each year.
          Inflation is deterministic. This is a v1 model — fat tails and regime changes
          are not modeled. Results should be used as planning guidance, not guarantees.
        </p>
      </div>

      {/* Depletion histogram */}
      {agg.depletionHistogram.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">
            Failure Year Distribution ({success.failureCount} failed paths)
          </h3>
          <div className="space-y-1.5">
            {(agg.depletionHistogram as Array<{ year: number; count: number; cumulativePct: number }>)
              .slice(0, 15)
              .map(({ year, count, cumulativePct }) => {
                const barWidth = (count / success.failureCount) * 100;
                return (
                  <div key={year} className="flex items-center gap-3 text-sm">
                    <span className="w-12 text-right text-slate-500 shrink-0">{year}</span>
                    <div className="flex-1 bg-slate-100 rounded overflow-hidden h-4">
                      <div
                        className="bg-red-400 h-full rounded"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="w-10 text-slate-600 shrink-0">{count}</span>
                    <span className="w-14 text-slate-400 text-xs shrink-0">
                      {pct(cumulativePct, 0)} cum.
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/app/monte-carlo')}>
          ← All Simulations
        </Button>
        <Button variant="outline" onClick={() => router.push(`/app/scenarios/${run.scenarioId}`)}>
          View Scenario
        </Button>
      </div>
    </div>
  );
}
