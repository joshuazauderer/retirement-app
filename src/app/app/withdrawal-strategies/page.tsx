'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { WithdrawalStrategySummaryItem } from '@/server/withdrawalStrategies/types';
import { strategyTypeLabel } from '@/server/withdrawalStrategies/withdrawalPolicyEngine';
import { orderingTypeLabel } from '@/server/withdrawalStrategies/withdrawalOrderingService';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function SuccessBadge({ success }: { success: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {success ? 'Funded' : 'Depletes'}
    </span>
  );
}

export default function WithdrawalStrategiesPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<WithdrawalStrategySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/withdrawal-strategies')
      .then((r) => r.json())
      .then((d) => { setRuns(d.runs ?? []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Withdrawal Strategies</h1>
          <p className="text-slate-500 mt-1">
            Evaluate how different withdrawal policies and account orderings affect plan durability.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/app/sequence-risk')}>
            Sequence Risk
          </Button>
          <Button onClick={() => router.push('/app/withdrawal-strategies/new')}>
            + New Analysis
          </Button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Needs-Based',
            desc: 'Withdraw exactly what is needed each year. The baseline approach.',
            color: 'border-blue-200 bg-blue-50',
          },
          {
            title: 'Fixed Withdrawal',
            desc: 'Fixed nominal or inflation-adjusted annual amount. Test durability.',
            color: 'border-purple-200 bg-purple-50',
          },
          {
            title: 'Guardrail Strategy',
            desc: 'Adjust spending when portfolio health changes. Reduce depletion risk.',
            color: 'border-amber-200 bg-amber-50',
          },
        ].map((f) => (
          <div key={f.title} className={`rounded-xl border p-4 ${f.color}`}>
            <h3 className="font-semibold text-slate-800 text-sm">{f.title}</h3>
            <p className="text-xs text-slate-600 mt-1">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Runs list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No withdrawal strategy analyses yet.</p>
          <Button className="mt-4" onClick={() => router.push('/app/withdrawal-strategies/new')}>
            Run Your First Analysis
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {runs.map((run) => (
              <div
                key={run.runId}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 cursor-pointer"
                onClick={() => router.push(`/app/withdrawal-strategies/${run.runId}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 truncate">{run.label}</span>
                    <SuccessBadge success={run.success} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {run.scenarioName} · {strategyTypeLabel(run.strategyType)} · {orderingTypeLabel(run.orderingType)}
                  </div>
                </div>
                <div className="flex items-center gap-6 ml-4 text-right shrink-0">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{fmt(run.endingAssets)}</div>
                    <div className="text-xs text-slate-400">ending assets</div>
                  </div>
                  {run.firstDepletionYear && (
                    <div>
                      <div className="text-sm font-medium text-red-600">{run.firstDepletionYear}</div>
                      <div className="text-xs text-slate-400">depletes</div>
                    </div>
                  )}
                  <div className="text-xs text-slate-400">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {runs.length >= 2 && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/app/withdrawal-strategies/compare')}>
            Compare Two Runs →
          </Button>
        </div>
      )}
    </div>
  );
}
