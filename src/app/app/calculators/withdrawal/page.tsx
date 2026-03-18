'use client';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/calculators/StatCard';
import { ValidationPanel } from '@/components/calculators/ValidationPanel';
import type { WithdrawalCalculatorResult } from '@/server/calculators/types';

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

export default function WithdrawalPage() {
  const [data, setData] = useState<{ validation: any; result: WithdrawalCalculatorResult | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch('/api/calculators/withdrawal').then(r => r.json()).then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">Analyzing withdrawals...</div>;
  if (!data) return null;
  const { validation, result } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Withdrawal Calculator</h1>
        <p className="text-slate-500 mt-1">Are your planned withdrawals sustainable?</p>
      </div>
      {validation && <ValidationPanel errors={validation.errors ?? []} warnings={validation.warnings ?? []} />}
      {result && (
        <>
          <div className={`p-4 rounded-xl border ${result.currentPlanDepletes ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            {result.currentPlanDepletes
              ? `⚠ Current plan depletes assets in ${result.currentPlanFirstDepletionYear ?? 'an unknown year'}.`
              : '✓ Current plan does not deplete assets before the end of the planning horizon.'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Planned Annual Withdrawal" value={fmt(result.plannedAnnualWithdrawal)} />
            <StatCard
              label="Sustainable Annual Withdrawal"
              value={result.sustainableAnnualWithdrawal !== null ? fmt(result.sustainableAnnualWithdrawal) : 'N/A'}
              highlight={result.sustainableAnnualWithdrawal !== null && result.sustainableAnnualWithdrawal >= result.plannedAnnualWithdrawal ? 'green' : 'yellow'}
            />
            <StatCard
              label="Difference"
              value={result.withdrawalDifference !== null ? fmt(result.withdrawalDifference) : 'N/A'}
              highlight={result.withdrawalDifference !== null && result.withdrawalDifference >= 0 ? 'green' : 'red'}
            />
          </div>
          {result.sustainableMonthlyWithdrawal !== null && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
              Estimated sustainable monthly withdrawal: <span className="font-semibold">{fmt(result.sustainableMonthlyWithdrawal)}/month</span>
            </div>
          )}
          <p className="text-xs text-slate-400">{result.note}</p>
        </>
      )}
    </div>
  );
}
