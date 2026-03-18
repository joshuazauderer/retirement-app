'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ScenarioSummary } from '@/server/scenarios/types';
import type {
  WithdrawalStrategyType,
  WithdrawalOrderingType,
  WithdrawalStrategyConfig,
  GuardrailConfig,
} from '@/server/withdrawalStrategies/types';
import { WS_BOUNDS } from '@/server/withdrawalStrategies/types';

const STRATEGY_OPTIONS: { value: WithdrawalStrategyType; label: string; desc: string }[] = [
  {
    value: 'NEEDS_BASED',
    label: 'Needs-Based',
    desc: 'Withdraw exactly what is needed to cover expenses each year. Uses the baseline engine behavior.',
  },
  {
    value: 'FIXED_NOMINAL',
    label: 'Fixed Nominal',
    desc: 'Withdraw a fixed dollar amount every year in retirement, regardless of inflation.',
  },
  {
    value: 'FIXED_REAL',
    label: 'Fixed Real (Inflation-Adjusted)',
    desc: 'Withdraw a fixed amount in today\'s dollars, inflated each year.',
  },
  {
    value: 'INFLATION_ADJUSTED_SPENDING',
    label: 'Inflation-Adjusted Spending',
    desc: 'Spending grows with inflation; withdrawals follow from the cash-flow gap. Explicit alias for needs-based.',
  },
  {
    value: 'GUARDRAIL',
    label: 'Simple Guardrail',
    desc: 'Adjust annual withdrawals based on portfolio health. Reduce when portfolio is down; increase when strong.',
  },
];

const ORDERING_OPTIONS: { value: WithdrawalOrderingType; label: string; desc: string }[] = [
  {
    value: 'TAXABLE_FIRST',
    label: 'Taxable First',
    desc: 'Taxable → Tax-Deferred → Tax-Free. Preserves tax-advantaged growth longest.',
  },
  {
    value: 'TAX_DEFERRED_FIRST',
    label: 'Tax-Deferred First',
    desc: 'Tax-Deferred → Taxable → Tax-Free. Depletes pre-tax accounts first.',
  },
  {
    value: 'TAX_FREE_FIRST',
    label: 'Tax-Free First',
    desc: 'Tax-Free (Roth) → Taxable → Tax-Deferred. Preserves tax-deferred accounts for RMDs.',
  },
  {
    value: 'PRO_RATA',
    label: 'Pro-Rata',
    desc: 'Withdraw proportionally from all accounts based on available balances.',
  },
];

export default function NewWithdrawalStrategyPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [strategyType, setStrategyType] = useState<WithdrawalStrategyType>('NEEDS_BASED');
  const [orderingType, setOrderingType] = useState<WithdrawalOrderingType>('TAXABLE_FIRST');
  const [annualTarget, setAnnualTarget] = useState('');
  const [label, setLabel] = useState('');
  // Guardrail fields
  const [initialWithdrawal, setInitialWithdrawal] = useState('');
  const [lowerGuardrail, setLowerGuardrail] = useState('80');
  const [upperGuardrail, setUpperGuardrail] = useState('150');
  const [decreaseStep, setDecreaseStep] = useState('10');
  const [increaseStep, setIncreaseStep] = useState('5');
  const [floorWithdrawal, setFloorWithdrawal] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then((d) => {
        const list: ScenarioSummary[] = d.scenarios ?? [];
        setScenarios(list);
        const baseline = list.find((s) => s.isBaseline);
        if (baseline) setScenarioId(baseline.id);
      });
  }, []);

  const needsTarget =
    strategyType === 'FIXED_NOMINAL' ||
    strategyType === 'FIXED_REAL' ||
    strategyType === 'GUARDRAIL';

  const handleRun = async () => {
    if (!scenarioId) { setError('Please select a scenario.'); return; }
    if (needsTarget && strategyType !== 'GUARDRAIL' && !annualTarget) {
      setError('Please enter an annual withdrawal target.');
      return;
    }
    if (strategyType === 'GUARDRAIL' && !initialWithdrawal) {
      setError('Please enter an initial annual withdrawal for the guardrail strategy.');
      return;
    }

    setRunning(true); setError(null);

    let config: WithdrawalStrategyConfig = {
      strategyType,
      orderingType,
      label: label || undefined,
    };

    if (strategyType === 'FIXED_NOMINAL' || strategyType === 'FIXED_REAL') {
      config = { ...config, annualWithdrawalTarget: parseFloat(annualTarget) };
    }

    if (strategyType === 'GUARDRAIL') {
      const guardrailConfig: GuardrailConfig = {
        initialAnnualWithdrawal: parseFloat(initialWithdrawal),
        lowerGuardrailPct: parseFloat(lowerGuardrail) / 100,
        upperGuardrailPct: parseFloat(upperGuardrail) / 100,
        decreaseStepPct: parseFloat(decreaseStep) / 100,
        increaseStepPct: parseFloat(increaseStep) / 100,
        floorAnnualWithdrawal: floorWithdrawal ? parseFloat(floorWithdrawal) : 0,
        ceilingMultiplier: 1.5,
      };
      config = { ...config, guardrailConfig };
    }

    try {
      const res = await fetch('/api/withdrawal-strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, config, label: label || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to run analysis.'); return; }
      router.push(`/app/withdrawal-strategies/${data.run.runId}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Withdrawal Strategy Analysis</h1>
        <p className="text-slate-500 mt-1">
          Test different withdrawal policies and account ordering strategies against your retirement plan.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>v1 model note:</strong> Annual time-step, planning-grade flat-rate taxes. Guardrail is a simplified
        approximation — not a branded framework. Results are planning guidance, not guarantees.
      </div>

      <div className="space-y-5">
        {/* Scenario */}
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

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Label <span className="text-slate-400 font-normal">optional</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Conservative fixed withdrawal"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Strategy type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Withdrawal Strategy</label>
          <div className="space-y-2">
            {STRATEGY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                  strategyType === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={opt.value}
                  checked={strategyType === opt.value}
                  onChange={() => setStrategyType(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Fixed target */}
        {(strategyType === 'FIXED_NOMINAL' || strategyType === 'FIXED_REAL') && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Annual Withdrawal Target ($)
            </label>
            <input
              type="number"
              min={0}
              max={WS_BOUNDS.MAX_WITHDRAWAL}
              step={1000}
              value={annualTarget}
              onChange={(e) => setAnnualTarget(e.target.value)}
              placeholder="e.g. 60000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {strategyType === 'FIXED_REAL' && (
              <p className="text-xs text-slate-400 mt-1">
                Enter in today&apos;s dollars. The engine inflates this each year.
              </p>
            )}
          </div>
        )}

        {/* Guardrail parameters */}
        {strategyType === 'GUARDRAIL' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-amber-900">Guardrail Configuration</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Initial Annual Withdrawal ($)</label>
                <input type="number" min={0} step={1000} value={initialWithdrawal} onChange={(e) => setInitialWithdrawal(e.target.value)} placeholder="e.g. 60000" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Spending Floor ($) <span className="text-slate-400">optional</span></label>
                <input type="number" min={0} step={1000} value={floorWithdrawal} onChange={(e) => setFloorWithdrawal(e.target.value)} placeholder="e.g. 40000" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lower Guardrail (% of initial portfolio)</label>
                <input type="number" min={1} max={99} step={1} value={lowerGuardrail} onChange={(e) => setLowerGuardrail(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                <p className="text-xs text-slate-400 mt-0.5">Cut spending below this portfolio level</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Upper Guardrail (% of initial portfolio)</label>
                <input type="number" min={100} max={300} step={1} value={upperGuardrail} onChange={(e) => setUpperGuardrail(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                <p className="text-xs text-slate-400 mt-0.5">Allow spending increase above this level</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Spending Cut % (when below lower)</label>
                <input type="number" min={1} max={50} step={1} value={decreaseStep} onChange={(e) => setDecreaseStep(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Spending Increase % (when above upper)</label>
                <input type="number" min={1} max={50} step={1} value={increaseStep} onChange={(e) => setIncreaseStep(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
            </div>
            <p className="text-xs text-amber-700">
              This is a planning-grade guardrail approximation, not a certified withdrawal framework. Results are for educational planning use only.
            </p>
          </div>
        )}

        {/* Ordering */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Account Withdrawal Ordering</label>
          <div className="space-y-2">
            {ORDERING_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                  orderingType === opt.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="ordering"
                  value={opt.value}
                  checked={orderingType === opt.value}
                  onChange={() => setOrderingType(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleRun} disabled={running || !scenarioId}>
          {running ? 'Running analysis...' : '▶ Run Analysis'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/app/withdrawal-strategies')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
