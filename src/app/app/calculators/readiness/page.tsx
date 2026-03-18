'use client';
import { useState, useEffect } from 'react';
import { StatCard } from '@/components/calculators/StatCard';
import { ValidationPanel } from '@/components/calculators/ValidationPanel';
import type { RetirementReadinessResult } from '@/server/calculators/types';

function fmt(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

export default function ReadinessPage() {
  const [data, setData] = useState<{ validation: any; result: RetirementReadinessResult | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch('/api/calculators/readiness').then(r => r.json()).then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">Calculating...</div>;
  if (!data) return null;
  const { validation, result } = data;

  const statusStyle = result?.status === 'Strong' ? 'bg-green-50 border-green-200'
    : result?.status === 'Needs Attention' ? 'bg-yellow-50 border-yellow-200'
    : 'bg-red-50 border-red-200';
  const badgeStyle = result?.status === 'Strong' ? 'bg-green-100 text-green-800'
    : result?.status === 'Needs Attention' ? 'bg-yellow-100 text-yellow-800'
    : 'bg-red-100 text-red-800';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Retirement Readiness</h1>
        <p className="text-slate-500 mt-1">Is your current plan on track?</p>
      </div>
      {validation && <ValidationPanel errors={validation.errors ?? []} warnings={validation.warnings ?? []} />}
      {result && (
        <>
          <div className={`p-5 rounded-xl border-2 ${statusStyle}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badgeStyle}`}>{result.status}</span>
              <span className="text-slate-500 text-sm">{result.projectionStartYear}–{result.projectionEndYear}</span>
            </div>
            <p className="text-slate-700">{result.statusReason}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Ending Balance" value={fmt(result.endingBalance)} highlight={result.success ? 'green' : 'red'} />
            <StatCard label="Ending Net Worth" value={fmt(result.endingNetWorth)} />
            <StatCard label="Years Funded" value={`${result.yearsFullyFunded} / ${result.yearsProjected}`} />
            <StatCard label="First Depletion" value={result.firstDepletionYear?.toString() ?? 'None'} highlight={result.firstDepletionYear ? 'red' : 'green'} />
            <StatCard label="Retirement Starts" value={result.firstRetirementYear?.toString() ?? 'N/A'} />
            <StatCard label="Horizon" value={`${result.projectionStartYear}–${result.projectionEndYear}`} />
            <StatCard label="Total Withdrawals" value={fmt(result.totalWithdrawals)} />
            <StatCard label="Total Taxes" value={fmt(result.totalTaxes)} />
          </div>
        </>
      )}
    </div>
  );
}
