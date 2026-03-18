'use client';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/calculators/StatCard';
import { ValidationPanel } from '@/components/calculators/ValidationPanel';
import type { SavingsGapResult } from '@/server/calculators/types';

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

export default function SavingsGapPage() {
  const [data, setData] = useState<{ validation: any; result: SavingsGapResult | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch('/api/calculators/savings-gap').then(r => r.json()).then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">Running savings gap analysis...</div>;
  if (!data) return null;
  const { validation, result } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Savings Gap Calculator</h1>
        <p className="text-slate-500 mt-1">How much more do you need to save or adjust to stay on track?</p>
      </div>
      {validation && <ValidationPanel errors={validation.errors ?? []} warnings={validation.warnings ?? []} />}
      {result && (
        <>
          <div className={`p-5 rounded-xl border ${result.baselineSuccess ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className="font-semibold text-slate-800 mb-1">
              {result.baselineSuccess ? '✓ Your current plan is on track.' : '⚠ Your current plan has a projected gap.'}
            </p>
            {result.firstDepletionYear && <p className="text-slate-600 text-sm">Assets projected to deplete in {result.firstDepletionYear}.</p>}
          </div>
          {!result.baselineSuccess && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-3">Option 1: Save More</h3>
                {result.additionalAnnualSavingsNeeded !== null
                  ? <div className="space-y-2">
                      <StatCard label="Additional Annual Savings" value={fmt(result.additionalAnnualSavingsNeeded)} highlight="blue" />
                      <StatCard label="Monthly Equivalent" value={fmt(result.additionalMonthlySavingsNeeded ?? 0)} />
                    </div>
                  : <p className="text-slate-500 text-sm">No feasible savings increase found within search bounds.</p>}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-3">Option 2: Spend Less in Retirement</h3>
                {result.retirementSpendingReductionNeeded !== null
                  ? <div className="space-y-2">
                      <StatCard label="Annual Reduction Needed" value={fmt(result.retirementSpendingReductionNeeded)} highlight="yellow" />
                      <StatCard label="Monthly Equivalent" value={fmt(result.retirementMonthlySpendingReductionNeeded ?? 0)} />
                    </div>
                  : <p className="text-slate-500 text-sm">No feasible spending reduction found within search bounds.</p>}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-400">{result.note}</p>
        </>
      )}
    </div>
  );
}
