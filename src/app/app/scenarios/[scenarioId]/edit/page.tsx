'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function ScenarioEditPage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Override state (all stored as display strings, converted on save)
  const [inflationOverride, setInflationOverride] = useState('');
  const [returnOverride, setReturnOverride] = useState('');
  const [taxOverride, setTaxOverride] = useState('');
  const [retirementEssentialOverride, setRetirementEssentialOverride] = useState('');
  const [discretionaryPctChange, setDiscretionaryPctChange] = useState('');
  const [additionalSavings, setAdditionalSavings] = useState('');
  const [healthcareOverride, setHealthcareOverride] = useState('');
  const [retirementAgeOverride, setRetirementAgeOverride] = useState('');

  useEffect(() => {
    fetch(`/api/scenarios/${scenarioId}`)
      .then(r => r.json())
      .then(d => {
        const s = d.scenario as Record<string, unknown>;
        setScenario(s);
        setName(s.name as string);
        setDescription((s.description as string) ?? '');
        const o = (s.overridesJson as Record<string, unknown>) ?? {};
        if (o.inflationRateOverride !== undefined)
          setInflationOverride(((o.inflationRateOverride as number) * 100).toString());
        if (o.expectedReturnOverride !== undefined)
          setReturnOverride(((o.expectedReturnOverride as number) * 100).toString());
        if (o.taxRateOverride !== undefined)
          setTaxOverride(((o.taxRateOverride as number) * 100).toString());
        if (o.retirementEssentialOverride !== undefined)
          setRetirementEssentialOverride((o.retirementEssentialOverride as number).toString());
        if (o.retirementDiscretionaryPctChange !== undefined)
          setDiscretionaryPctChange(((o.retirementDiscretionaryPctChange as number) * 100).toString());
        if (o.additionalAnnualSavings !== undefined)
          setAdditionalSavings((o.additionalAnnualSavings as number).toString());
        if (o.healthcareAnnualOverride !== undefined)
          setHealthcareOverride((o.healthcareAnnualOverride as number).toString());
        const memberOverrides = o.memberOverrides as Array<Record<string, unknown>> | undefined;
        if (memberOverrides?.[0]?.retirementAgeOverride !== undefined)
          setRetirementAgeOverride((memberOverrides[0].retirementAgeOverride as number).toString());
        setLoading(false);
      });
  }, [scenarioId]);

  const save = async () => {
    setSaving(true); setError(null);
    const overrides: Record<string, unknown> = {};
    if (inflationOverride) overrides.inflationRateOverride = parseFloat(inflationOverride) / 100;
    if (returnOverride) overrides.expectedReturnOverride = parseFloat(returnOverride) / 100;
    if (taxOverride) overrides.taxRateOverride = parseFloat(taxOverride) / 100;
    if (retirementEssentialOverride) overrides.retirementEssentialOverride = parseFloat(retirementEssentialOverride);
    if (discretionaryPctChange) overrides.retirementDiscretionaryPctChange = parseFloat(discretionaryPctChange) / 100;
    if (additionalSavings) overrides.additionalAnnualSavings = parseFloat(additionalSavings);
    if (healthcareOverride) overrides.healthcareAnnualOverride = parseFloat(healthcareOverride);

    // Carry forward member overrides if retirement age is set
    if (retirementAgeOverride) {
      const existingMemberOverrides = ((scenario?.overridesJson as Record<string, unknown>)?.memberOverrides as Array<Record<string, unknown>> | undefined);
      const memberId = existingMemberOverrides?.[0]?.memberId as string | undefined;
      if (memberId) {
        overrides.memberOverrides = [{ memberId, retirementAgeOverride: parseInt(retirementAgeOverride) }];
      }
    }

    const res = await fetch(`/api/scenarios/${scenarioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        overrides: Object.keys(overrides).length > 0 ? overrides : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error as string); setSaving(false); return; }
    router.push(`/app/scenarios/${scenarioId}`);
  };

  if (loading) return <div className="text-center py-16 text-slate-400">Loading...</div>;

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Scenario</h1>
        <p className="text-slate-500 mt-1">Adjust assumptions. Leave fields blank to use baseline values.</p>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Scenario Details</h3>
        <div>
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className={`mt-1 ${inputClass}`} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {/* Retirement Timing */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Retirement Timing</h3>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Retirement Age Override (primary member)
          </label>
          <input
            type="number"
            value={retirementAgeOverride}
            onChange={e => setRetirementAgeOverride(e.target.value)}
            placeholder="e.g. 63"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {/* Planning Assumptions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Planning Assumptions</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Inflation Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={inflationOverride}
              onChange={e => setInflationOverride(e.target.value)}
              placeholder="e.g. 3.5"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Expected Return (%)</label>
            <input
              type="number"
              step="0.1"
              value={returnOverride}
              onChange={e => setReturnOverride(e.target.value)}
              placeholder="e.g. 6.0"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Effective Tax Rate (%)</label>
            <input
              type="number"
              step="0.5"
              value={taxOverride}
              onChange={e => setTaxOverride(e.target.value)}
              placeholder="e.g. 20"
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
      </div>

      {/* Retirement Spending */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Retirement Spending</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Essential Spending ($/yr)</label>
            <input
              type="number"
              value={retirementEssentialOverride}
              onChange={e => setRetirementEssentialOverride(e.target.value)}
              placeholder="e.g. 48000"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Discretionary Change (%)</label>
            <input
              type="number"
              value={discretionaryPctChange}
              onChange={e => setDiscretionaryPctChange(e.target.value)}
              placeholder="e.g. -10 or +10"
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Healthcare ($/yr)</label>
            <input
              type="number"
              value={healthcareOverride}
              onChange={e => setHealthcareOverride(e.target.value)}
              placeholder="e.g. 8000"
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>
      </div>

      {/* Savings */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800">Savings</h3>
        <div>
          <label className="text-sm font-medium text-slate-700">Additional Annual Savings ($/yr)</label>
          <input
            type="number"
            value={additionalSavings}
            onChange={e => setAdditionalSavings(e.target.value)}
            placeholder="e.g. 10000"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Scenario'}
        </Button>
        <Button variant="outline" onClick={() => router.push(`/app/scenarios/${scenarioId}`)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
