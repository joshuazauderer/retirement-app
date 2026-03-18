'use client';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/calculators/StatCard';
import { ValidationPanel } from '@/components/calculators/ValidationPanel';
import { SimpleLineChart } from '@/components/calculators/SimpleLineChart';
import type { RetirementIncomeProjectionResult } from '@/server/calculators/types';

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

export default function IncomeProjectionPage() {
  const [data, setData] = useState<{ validation: any; result: RetirementIncomeProjectionResult | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch('/api/calculators/income-projection').then(r => r.json()).then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">Projecting income...</div>;
  if (!data) return null;
  const { validation, result } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Retirement Income Projection</h1>
        <p className="text-slate-500 mt-1">How your retirement will be funded year by year.</p>
      </div>
      {validation && <ValidationPanel errors={validation.errors ?? []} warnings={validation.warnings ?? []} />}
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Avg Retirement Income" value={fmt(result.averageAnnualRetirementIncome)} />
            <StatCard label="Avg Retirement Withdrawals" value={fmt(result.averageAnnualRetirementWithdrawals)} />
            <StatCard label="Total Retirement Income" value={fmt(result.totalRetirementIncome)} />
            <StatCard label="Years With Shortfall" value={result.yearsWithShortfall.toString()} highlight={result.yearsWithShortfall > 0 ? 'red' : 'green'} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Income vs Expenses Over Time</h3>
            <SimpleLineChart series={[
              { name: 'Total Income', color: '#3b82f6', data: result.allYears.map(y => ({ x: y.year, y: y.totalIncome })) },
              { name: 'Expenses', color: '#ef4444', data: result.allYears.map(y => ({ x: y.year, y: y.expenses })) },
            ]} />
          </div>
          {result.retirementYears.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-3 text-sm">Benefits vs Withdrawals (Retirement)</h3>
                <SimpleLineChart series={[
                  { name: 'Benefits', color: '#10b981', data: result.retirementYears.map(y => ({ x: y.year, y: y.benefitsIncome })) },
                  { name: 'Withdrawals', color: '#f59e0b', data: result.retirementYears.map(y => ({ x: y.year, y: y.withdrawals })) },
                ]} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">Year-by-Year (first 25 retirement years)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Year','Earned','Benefits','Withdrawals','Total Income','Expenses','Surplus'].map(h => (
                          <th key={h} className={`px-3 py-2 font-medium text-slate-500 ${h === 'Year' ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.retirementYears.slice(0, 25).map(y => (
                        <tr key={y.year} className={y.surplus < 0 ? 'bg-red-50' : ''}>
                          <td className="px-3 py-2 font-medium">{y.year}</td>
                          <td className="px-3 py-2 text-right">{fmt(y.earnedIncome)}</td>
                          <td className="px-3 py-2 text-right">{fmt(y.benefitsIncome)}</td>
                          <td className="px-3 py-2 text-right">{fmt(y.withdrawals)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(y.totalIncome)}</td>
                          <td className="px-3 py-2 text-right">{fmt(y.expenses)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${y.surplus >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(y.surplus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
