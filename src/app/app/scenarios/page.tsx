'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ScenarioSummary } from '@/server/scenarios/types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function ScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = () =>
    fetch('/api/scenarios')
      .then(r => r.json())
      .then(d => {
        setScenarios(d.scenarios ?? []);
        setLoading(false);
      });

  useEffect(() => {
    load();
  }, []);

  const action = async (url: string, method = 'POST') => {
    setActionLoading(url);
    await fetch(url, { method });
    setActionLoading(null);
    load();
  };

  const runScenario = async (id: string) => {
    setActionLoading(id);
    await fetch(`/api/scenarios/${id}/run`, { method: 'POST' });
    setActionLoading(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scenarios</h1>
          <p className="text-slate-500 mt-1">Create and compare alternative retirement plans.</p>
        </div>
        <Button onClick={() => router.push('/app/scenarios/new')}>+ New Scenario</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {scenarios.map(s => (
            <div
              key={s.id}
              className={`bg-white rounded-xl border p-4 ${s.isBaseline ? 'border-blue-200' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900">{s.name}</h3>
                    {s.isBaseline && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        Baseline
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                      {s.scenarioType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {s.description && <p className="text-sm text-slate-500">{s.description}</p>}
                  {s.latestRun && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className={s.latestRun.success ? 'text-green-700' : 'text-red-700'}>
                        {s.latestRun.success ? '✓ Funded' : '✗ Depletes'}
                      </span>
                      <span>Ending: {fmt(Number(s.latestRun.endingBalance))}</span>
                      {s.latestRun.firstDepletionYear && (
                        <span>Depletes {s.latestRun.firstDepletionYear}</span>
                      )}
                      <span>
                        {s.latestRun.projectionStartYear}–{s.latestRun.projectionEndYear}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/app/scenarios/${s.id}`)}>
                    View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/app/scenarios/${s.id}/edit`)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading === s.id}
                    onClick={() => runScenario(s.id)}
                  >
                    {actionLoading === s.id ? '...' : '▶ Run'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => action(`/api/scenarios/${s.id}/duplicate`)}
                  >
                    Copy
                  </Button>
                  {!s.isBaseline && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => action(`/api/scenarios/${s.id}/set-baseline`)}
                    >
                      Set Baseline
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {scenarios.length >= 2 && (
            <div className="pt-2">
              <Button variant="outline" onClick={() => router.push('/app/scenarios/compare')}>
                Compare Scenarios →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
