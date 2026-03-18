'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ScenarioSummary } from '@/server/scenarios/types';
import type {
  WithdrawalStrategyType,
  WithdrawalOrderingType,
  StressPath,
  SequenceRiskStressResult,
  SequenceRiskRunResult,
} from '@/server/withdrawalStrategies/types';
import { strategyTypeLabel } from '@/server/withdrawalStrategies/withdrawalPolicyEngine';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function StressPathCard({ item }: { item: SequenceRiskRunResult }) {
  const { stressPath, result, depletionYearDelta, endingAssetDelta, vulnerableYears } = item;
  const severityColor =
    endingAssetDelta < -500_000
      ? 'border-red-300 bg-red-50'
      : endingAssetDelta < -100_000
      ? 'border-amber-300 bg-amber-50'
      : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-xl border p-5 ${severityColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{stressPath.label}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{stressPath.description}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {result.success ? 'Survives' : 'Depletes'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-slate-500 text-xs">Ending Assets</div>
          <div className="font-semibold text-slate-900">{fmt(result.endingAssets)}</div>
          <div className={`text-xs font-medium ${endingAssetDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {endingAssetDelta >= 0 ? '+' : ''}{fmt(endingAssetDelta)} vs baseline
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-xs">First Depletion</div>
          <div className="font-semibold text-slate-900">
            {result.firstDepletionYear?.toString() ?? 'Never'}
          </div>
          {depletionYearDelta !== null && (
            <div className={`text-xs font-medium ${depletionYearDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {depletionYearDelta >= 0 ? '+' : ''}{depletionYearDelta} yrs vs baseline
            </div>
          )}
          {depletionYearDelta === null && result.firstDepletionYear !== null && (
            <div className="text-xs font-medium text-red-600">Depletes (baseline survives)</div>
          )}
        </div>
      </div>

      {vulnerableYears.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Vulnerable years (stress has shortfall; baseline does not): {vulnerableYears.slice(0, 8).join(', ')}
            {vulnerableYears.length > 8 && ` +${vulnerableYears.length - 8} more`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SequenceRiskPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [stressPaths, setStressPaths] = useState<StressPath[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [strategyType, setStrategyType] = useState<WithdrawalStrategyType>('NEEDS_BASED');
  const [orderingType] = useState<WithdrawalOrderingType>('TAXABLE_FIRST');
  const [annualTarget, setAnnualTarget] = useState('');
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SequenceRiskStressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/scenarios').then((r) => r.json()),
      fetch('/api/sequence-risk').then((r) => r.json()),
    ]).then(([scenarioData, pathData]) => {
      const list: ScenarioSummary[] = scenarioData.scenarios ?? [];
      setScenarios(list);
      const baseline = list.find((s) => s.isBaseline);
      if (baseline) setScenarioId(baseline.id);
      setStressPaths(pathData.stressPaths ?? []);
      setSelectedPathIds((pathData.stressPaths ?? []).map((p: StressPath) => p.id));
    });
  }, []);

  const needsTarget = strategyType === 'FIXED_NOMINAL' || strategyType === 'FIXED_REAL';

  const togglePath = (id: string) => {
    setSelectedPathIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleRun = async () => {
    if (!scenarioId) { setError('Please select a scenario.'); return; }
    if (selectedPathIds.length === 0) { setError('Please select at least one stress path.'); return; }
    if (needsTarget && !annualTarget) { setError('Please enter an annual withdrawal target.'); return; }

    setRunning(true); setError(null); setResult(null);

    const config = {
      strategyType,
      orderingType,
      ...(needsTarget ? { annualWithdrawalTarget: parseFloat(annualTarget) } : {}),
    };

    try {
      const res = await fetch('/api/sequence-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, config, stressPathIds: selectedPathIds }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Analysis failed.'); return; }
      setResult(data.result);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sequence of Returns Risk</h1>
        <p className="text-slate-500 mt-1">
          Understand how poor early-retirement returns affect long-term plan durability. Poor returns early
          cause disproportionate damage because withdrawals occur while balances are depressed.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>What this shows:</strong> The same withdrawal strategy is run under normal assumptions (baseline)
        and under each stress path (bad early returns). The difference reveals how vulnerable your plan is to
        sequence risk in early retirement.
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Analysis Configuration</h3>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Scenario</label>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a scenario...</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isBaseline ? ' (Baseline)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Withdrawal Strategy</label>
          <div className="grid grid-cols-2 gap-2">
            {(['NEEDS_BASED', 'FIXED_NOMINAL', 'FIXED_REAL', 'GUARDRAIL'] as WithdrawalStrategyType[]).map((s) => (
              <label
                key={s}
                className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${
                  strategyType === s ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                }`}
              >
                <input type="radio" checked={strategyType === s} onChange={() => setStrategyType(s)} />
                {strategyTypeLabel(s)}
              </label>
            ))}
          </div>
        </div>

        {needsTarget && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Annual Withdrawal Target ($)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={annualTarget}
              onChange={(e) => setAnnualTarget(e.target.value)}
              placeholder="e.g. 60000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Stress Paths to Run</label>
          <div className="space-y-2">
            {stressPaths.map((p) => (
              <label
                key={p.id}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                  selectedPathIds.includes(p.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedPathIds.includes(p.id)}
                  onChange={() => togglePath(p.id)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">{p.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleRun} disabled={running || !scenarioId || selectedPathIds.length === 0}>
          {running ? 'Running analysis...' : '▶ Run Sequence Risk Analysis'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/app/withdrawal-strategies')}>
          ← Withdrawal Strategies
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Baseline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-slate-700">Baseline (Normal Returns)</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                result.baseline.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {result.baseline.success ? 'Survives' : 'Depletes'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-slate-500 text-xs">Ending Assets</div>
                <div className="font-semibold">{fmt(result.baseline.endingAssets)}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">First Depletion</div>
                <div className="font-semibold">{result.baseline.firstDepletionYear?.toString() ?? 'Never'}</div>
              </div>
              <div>
                <div className="text-slate-500 text-xs">Total Withdrawals</div>
                <div className="font-semibold">{fmt(result.baseline.totalWithdrawals)}</div>
              </div>
            </div>
          </div>

          {/* Stress results */}
          <h3 className="font-semibold text-slate-800">Stress Path Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.stressResults.map((item) => (
              <StressPathCard key={item.stressPath.id} item={item} />
            ))}
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-500">
            <strong>Interpretation:</strong> Stress paths inject below-baseline returns in the years shown (null entries use
            your planning assumption return). A fragile plan depletes sooner or ends with significantly fewer assets under
            stress. A resilient plan maintains funding even under early market weakness.
          </div>
        </div>
      )}
    </div>
  );
}
