'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SCENARIO_TEMPLATES } from '@/server/scenarios/templates';
import type { ScenarioOverridePayload } from '@/server/scenarios/types';

const SCENARIO_TYPES = [
  'BASELINE', 'EARLY_RETIREMENT', 'DELAYED_RETIREMENT', 'LOWER_SPENDING',
  'HIGHER_SPENDING', 'SS_DELAY', 'DOWNSIZING', 'PART_TIME', 'HIGHER_SAVINGS',
  'HIGHER_INFLATION', 'CUSTOM',
];

export default function NewScenarioPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scenarioType, setScenarioType] = useState('CUSTOM');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (overrides?: ScenarioOverridePayload) => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true); setError(null);
    const res = await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, scenarioType, overrides: overrides ?? null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setLoading(false); return; }
    router.push(`/app/scenarios/${data.scenario.id}/edit`);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Scenario</h1>
        <p className="text-slate-500 mt-1">Create a new planning scenario to explore alternative retirement paths.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Scenario Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Retire at 63"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Type</label>
          <select
            value={scenarioType}
            onChange={e => setScenarioType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SCENARIO_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={() => create()} disabled={loading}>
            {loading ? 'Creating...' : 'Create & Edit'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/app/scenarios')}>Cancel</Button>
        </div>
      </div>

      {/* Quick-start templates */}
      <div>
        <h2 className="font-semibold text-slate-800 mb-3">Or start from a template</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCENARIO_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setName(t.label);
                setScenarioType(t.scenarioType);
                setDescription(t.description);
                // Build overrides with placeholder context — edit page allows refinement
                const overrides = t.buildOverrides({
                  primaryMemberRetirementAge: 65,
                  currentDiscretionary: 36000,
                  currentSavings: 0,
                  currentInflation: 0.03,
                  currentReturn: 0.07,
                });
                create(overrides);
              }}
              className="text-left p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <p className="font-medium text-slate-900 text-sm">{t.label}</p>
              <p className="text-xs text-slate-500 mt-1">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
