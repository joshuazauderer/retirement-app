'use client';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/calculators/StatCard';
import { ValidationPanel } from '@/components/calculators/ValidationPanel';
import type { YearsUntilRetirementResult } from '@/server/calculators/types';

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

export default function YearsUntilRetirementPage() {
  const [data, setData] = useState<{ validation: any; result: YearsUntilRetirementResult | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch('/api/calculators/years-until-retirement').then(r => r.json()).then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">Computing...</div>;
  if (!data) return null;
  const { validation, result } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Years Until Retirement</h1>
        <p className="text-slate-500 mt-1">Your path from today to retirement.</p>
      </div>
      {validation && <ValidationPanel errors={validation.errors ?? []} warnings={validation.warnings ?? []} />}
      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.members.map(m => (
              <div key={m.memberId} className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">{m.firstName}</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  {[
                    ['Current Age', m.currentAge.toString()],
                    ['Retirement Age', m.retirementTargetAge.toString()],
                    ['Retirement Year', m.retirementYear.toString()],
                    [m.alreadyRetired ? 'Status' : 'Years Until Retirement',
                     m.alreadyRetired ? 'Retired' : `${m.yearsUntilRetirement} years`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span>{label}</span>
                      <span className={`font-medium ${label === 'Status' || label === 'Years Until Retirement' ? (m.alreadyRetired ? 'text-green-700' : 'text-blue-700') : ''}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              label="Household Retirement Year"
              value={result.householdRetirementYear.toString()}
              sub={result.yearsUntilHouseholdRetirement === 0 ? 'Already retired' : `${result.yearsUntilHouseholdRetirement} years away`}
            />
            <StatCard label="Projected Assets at Retirement" value={fmt(result.projectedAssetsAtRetirement)} />
            <StatCard
              label={result.projectedFundingGapAtRetirement >= 0 ? 'Income Surplus at Retirement' : 'Income Gap at Retirement'}
              value={fmt(Math.abs(result.projectedFundingGapAtRetirement))}
              highlight={result.projectedFundingGapAtRetirement >= 0 ? 'green' : 'red'}
            />
            <StatCard label="Projected Annual Income" value={fmt(result.projectedAnnualIncomeAtRetirement)} />
            <StatCard label="Projected Annual Expenses" value={fmt(result.projectedAnnualExpensesAtRetirement)} />
          </div>
        </>
      )}
    </div>
  );
}
