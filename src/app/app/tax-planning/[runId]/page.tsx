'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { TaxPlanningRunResult } from '@/server/tax/types';

function fmt(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string; sub?: string; color?: 'blue' | 'red' | 'green' | 'slate' | 'amber';
}) {
  const colorMap = {
    blue: 'text-blue-700',
    red: 'text-red-700',
    green: 'text-green-700',
    slate: 'text-slate-700',
    amber: 'text-amber-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function TaxPlanningRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<TaxPlanningRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/tax-planning/${runId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setRun(d.run); })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading…</div>;
  if (error || !run) return (
    <div className="text-red-600 py-12 text-center">
      {error || 'Run not found.'}
      <div className="mt-4"><Link href="/app/tax-planning"><Button variant="outline">Back</Button></Link></div>
    </div>
  );

  const s = run.summary;
  const ta = run.taxAssumptions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{run.label}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {run.scenarioName} · {ta.filingStatus.replace(/_/g, ' ')} · {ta.stateOfResidence} ·{' '}
            {new Date(run.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/tax-planning"><Button variant="outline" size="sm">← Back</Button></Link>
          <Link href="/app/tax-planning/new"><Button size="sm">+ New Analysis</Button></Link>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
        Planning estimates only. Federal brackets: 2024 base inflated forward. State: flat effective rate.
        SS taxation: provisional income approximation. Not tax preparation software.
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Lifetime Tax" value={fmt(s.totalLifetimeTax)} color="red" />
        <StatCard label="Federal Tax" value={fmt(s.totalFederalTax)} sub={`${fmtPct(s.averageEffectiveRate)} avg effective`} />
        <StatCard label="State Tax" value={fmt(s.totalStateTax)} sub={ta.stateOfResidence} color="slate" />
        <StatCard label="Capital Gains Tax" value={fmt(s.totalCapitalGainsTax)} color="amber" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Ending Assets" value={fmt(s.endingAssets)} color={s.success ? 'green' : 'red'} />
        <StatCard label="Total Withdrawals" value={fmt(s.totalWithdrawals)} color="slate" />
        <StatCard label="Peak Annual Tax" value={fmt(s.peakAnnualTax)} sub={`Year ${s.peakTaxYear}`} color="amber" />
        <StatCard
          label="Plan Status"
          value={s.success ? 'Fully Funded' : `Depleted ${s.firstDepletionYear}`}
          color={s.success ? 'green' : 'red'}
        />
      </div>

      {/* Roth conversion summary */}
      {s.rothConversionYears > 0 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-3">
          <h3 className="font-semibold text-purple-900">Roth Conversion Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-purple-400">Conversion Years</div>
              <div className="font-medium">{s.rothConversionYears} years</div>
            </div>
            <div>
              <div className="text-xs text-purple-400">Total Converted</div>
              <div className="font-medium">{fmt(s.totalRothConverted)}</div>
            </div>
            <div>
              <div className="text-xs text-purple-400">Conversion Tax Cost</div>
              <div className="font-medium text-red-700">{fmt(s.totalRothConversionTax)}</div>
            </div>
            <div>
              <div className="text-xs text-purple-400">Config</div>
              <div className="font-medium text-xs">
                {ta.rothConversion
                  ? `${fmt(ta.rothConversion.annualConversionAmount)}/yr · ${ta.rothConversion.startYear}–${ta.rothConversion.endYear}`
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Year-by-year table */}
      {run.yearByYear.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Year-by-Year Tax Detail</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Year</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Gross Income</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">SS Taxable</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">TD Withdrawal</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Cap Gains</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Roth Conv.</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Federal Tax</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">State Tax</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Total Tax</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Eff. Rate</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500">Ending Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {run.yearByYear.slice(0, 50).map((yr) => (
                  <tr
                    key={yr.year}
                    className={
                      yr.depleted ? 'bg-red-50' :
                      yr.rothConversionAmount > 0 ? 'bg-purple-50' :
                      'hover:bg-slate-50'
                    }
                  >
                    <td className="px-3 py-2 font-mono text-slate-600">{yr.year}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(yr.grossIncome)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {yr.taxBreakdown.ssTaxableAmount > 0 ? fmt(yr.taxBreakdown.ssTaxableAmount) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {yr.taxDeferredWithdrawal > 0 ? fmt(yr.taxDeferredWithdrawal) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {yr.taxBreakdown.capitalGainsAmount > 0 ? fmt(yr.taxBreakdown.capitalGainsAmount) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {yr.rothConversionAmount > 0
                        ? <span className="text-purple-700 font-medium">{fmt(yr.rothConversionAmount)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(yr.taxBreakdown.federalTax)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(yr.taxBreakdown.stateTax)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">{fmt(yr.totalTax)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtPct(yr.taxBreakdown.effectiveTotalRate)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {yr.depleted
                        ? <span className="text-red-600 font-medium">Depleted</span>
                        : fmt(yr.endingAssets)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {run.yearByYear.length > 50 && (
            <div className="text-xs text-slate-400 text-center mt-2">Showing first 50 of {run.yearByYear.length} years</div>
          )}
        </div>
      )}

      {/* Assumptions panel */}
      <div className="rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Assumptions Used</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-400">Filing Status</div>
            <div className="font-medium">{ta.filingStatus.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">State</div>
            <div className="font-medium">{ta.stateOfResidence}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Bracket Base Year</div>
            <div className="font-medium">{ta.bracketBaseYear}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Cost Basis Ratio</div>
            <div className="font-medium">{fmtPct(ta.capitalGainsBasisRatio)} of taxable balance</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Projection Years</div>
            <div className="font-medium">{s.projectionStartYear}–{s.projectionEndYear}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Roth Conversion</div>
            <div className="font-medium">
              {ta.rothConversion
                ? `${fmt(ta.rothConversion.annualConversionAmount)}/yr · ${ta.rothConversion.startYear}–${ta.rothConversion.endYear}`
                : 'None'}
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        Planning-grade model. Annual time-step. Federal brackets: 2024 base, inflated forward.
        State rates: flat effective rate approximation. SS: provisional income method.
        Capital gains: gain-ratio approximation from cost basis assumption.
        Not IRS- or SSA-certified. Consult a tax advisor.
      </div>
    </div>
  );
}
