'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { TaxPlanningSummaryItem } from '@/server/tax/types';

function fmt(n: number) { return `$${Math.round(n).toLocaleString()}`; }

export default function RothConversionsPage() {
  const [runs, setRuns] = useState<TaxPlanningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/roth-conversions')
      .then((r) => r.json())
      .then((d) => setRuns(d.runs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const rothRuns = runs.filter((r) => r.hasRothConversion);
  const baseRuns = runs.filter((r) => !r.hasRothConversion);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roth Conversions</h1>
          <p className="text-slate-500 text-sm mt-1">
            Model the tax impact of converting tax-deferred savings to tax-free (Roth) accounts.
          </p>
        </div>
        <Link href="/app/tax-planning/new">
          <Button>+ New Conversion Analysis</Button>
        </Link>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-3">
        <h3 className="font-semibold text-purple-900">How Roth Conversion Modeling Works</h3>
        <div className="text-sm text-purple-800 space-y-2">
          <p>
            A Roth conversion moves money from a tax-deferred account (Traditional IRA, 401k)
            to a tax-free account (Roth IRA). The converted amount is taxed as ordinary income
            in the conversion year — increasing near-term taxes.
          </p>
          <p>
            The benefit: future withdrawals from the Roth account are tax-free, which can reduce
            total lifetime taxes and improve plan durability — especially if you expect to be in
            a higher bracket later.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-purple-200">
            <div>
              <div className="font-medium text-purple-900">Conversion increases near-term taxes</div>
              <div className="text-xs mt-0.5">The converted amount is added to ordinary income in the conversion year.</div>
            </div>
            <div>
              <div className="font-medium text-purple-900">May reduce long-term taxes</div>
              <div className="text-xs mt-0.5">Future withdrawals from the Roth balance are tax-free, lowering retirement-year tax burden.</div>
            </div>
            <div>
              <div className="font-medium text-purple-900">Affects withdrawal ordering</div>
              <div className="text-xs mt-0.5">Larger Roth balance changes how the engine draws down accounts in retirement.</div>
            </div>
            <div>
              <div className="font-medium text-purple-900">Best compared side-by-side</div>
              <div className="text-xs mt-0.5">Run one analysis with conversion and one without, then compare on the Tax Planning page.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
        <strong>Planning estimates only.</strong> The conversion tax impact uses planning-grade bracket and state rate approximations.
        Actual tax consequences depend on your full tax picture. Consult a CPA before executing Roth conversions.
      </div>

      {/* Quick-start CTA */}
      {runs.length === 0 && !loading && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <div className="text-4xl mb-3">🔄</div>
          <div className="font-medium text-slate-700 mb-1">No tax analyses yet</div>
          <div className="text-sm text-slate-400 mb-4">
            Run a tax analysis with Roth conversions enabled to see the impact here.
          </div>
          <Link href="/app/tax-planning/new"><Button>+ New Tax Analysis</Button></Link>
        </div>
      )}

      {loading && <div className="text-slate-400 py-8 text-center">Loading…</div>}

      {/* Roth conversion runs */}
      {rothRuns.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Analyses with Roth Conversions</h2>
          <div className="space-y-3">
            {rothRuns.map((r) => (
              <div key={r.runId} className="rounded-xl border border-purple-200 bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/app/tax-planning/${r.runId}`} className="font-semibold text-blue-600 hover:underline">
                      {r.label}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5">{r.scenarioName} · {new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {r.success ? 'Funded' : `Depleted ${r.firstDepletionYear}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">Lifetime Tax</div>
                    <div className="font-medium text-red-700">{fmt(r.totalLifetimeTax)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Ending Assets</div>
                    <div className="font-medium">{fmt(r.endingAssets)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Total Withdrawals</div>
                    <div className="font-medium">{fmt(r.totalWithdrawals)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Baseline (no conversion) runs */}
      {baseRuns.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Analyses Without Roth Conversions</h2>
          <div className="space-y-2">
            {baseRuns.map((r) => (
              <div key={r.runId} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                <div>
                  <Link href={`/app/tax-planning/${r.runId}`} className="font-medium text-blue-600 hover:underline text-sm">
                    {r.label}
                  </Link>
                  <div className="text-xs text-slate-400">{r.scenarioName} · Lifetime tax: {fmt(r.totalLifetimeTax)}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.success ? 'Funded' : `Depleted ${r.firstDepletionYear}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison prompt */}
      {rothRuns.length > 0 && baseRuns.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-5 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-900">Compare a conversion run vs. a baseline</div>
            <div className="text-xs text-slate-500 mt-0.5">Go to Tax Planning, select A and B runs, then click Compare.</div>
          </div>
          <Link href="/app/tax-planning">
            <Button variant="outline" size="sm">Go to Tax Planning →</Button>
          </Link>
        </div>
      )}

      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        Planning estimates only. Annual time-step model. Roth conversion tax uses marginal rate approximation.
        Not tax preparation software. Consult a CPA or tax advisor before executing Roth conversions.
      </div>
    </div>
  );
}
