'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Scenario {
  id: string;
  name: string;
  isBaseline: boolean;
}

export default function NewHealthcarePlanningPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Base fields
  const [scenarioId, setScenarioId] = useState('');
  const [label, setLabel] = useState('');

  // Pre-Medicare
  const [annualPremium, setAnnualPremium] = useState('12000');
  const [annualOOP, setAnnualOOP] = useState('3000');

  // Medicare
  const [medicareAge, setMedicareAge] = useState('65');
  const [includePartB, setIncludePartB] = useState(true);
  const [includePartD, setIncludePartD] = useState(true);
  const [includeMedigap, setIncludeMedigap] = useState(true);
  const [medicareOOP, setMedicareOOP] = useState('1200');

  // Healthcare inflation
  const [inflationRate, setInflationRate] = useState('5');

  // LTC stress
  const [ltcEnabled, setLtcEnabled] = useState(false);
  const [ltcStartAge, setLtcStartAge] = useState('80');
  const [ltcDuration, setLtcDuration] = useState('3');
  const [ltcAnnualCost, setLtcAnnualCost] = useState('90000');

  // Longevity stress
  const [longevityEnabled, setLongevityEnabled] = useState(false);
  const [longevityTargetAge, setLongevityTargetAge] = useState('95');
  const [longevityPerson, setLongevityPerson] = useState<'primary' | 'spouse' | 'both'>('primary');

  // Spouse
  const [includeSpouse, setIncludeSpouse] = useState(false);

  useEffect(() => {
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then((d) => {
        const sc: Scenario[] = d.scenarios ?? [];
        setScenarios(sc);
        const baseline = sc.find((s) => s.isBaseline) ?? sc[0];
        if (baseline) setScenarioId(baseline.id);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!scenarioId) { setError('Please select a scenario.'); return; }
    if (!label.trim()) { setError('Please provide a label.'); return; }
    setSubmitting(true);

    const body = {
      scenarioId,
      label,
      preMedicare: {
        annualPremium: Number(annualPremium),
        annualOutOfPocket: Number(annualOOP),
      },
      medicareEligibilityAge: Number(medicareAge),
      medicare: {
        includePartB,
        includePartD,
        includeMedigapOrAdvantage: includeMedigap,
        additionalAnnualOOP: Number(medicareOOP),
      },
      healthcareInflationRate: Number(inflationRate) / 100,
      ltcStress: {
        enabled: ltcEnabled,
        startAge: Number(ltcStartAge),
        durationYears: Number(ltcDuration),
        annualCost: Number(ltcAnnualCost),
      },
      longevityStress: {
        enabled: longevityEnabled,
        targetAge: Number(longevityTargetAge),
        person: longevityPerson,
      },
      includeSpouseHealthcare: includeSpouse,
    };

    try {
      const res = await fetch('/api/healthcare-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to run analysis.'); return; }
      router.push(`/app/healthcare-planning/${data.runId}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading scenarios...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Healthcare Analysis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Model healthcare costs and stress-test your retirement plan.
          </p>
        </div>
        <Link href="/app/healthcare-planning">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimates only.</strong> Medicare premiums based on 2024 values inflated
        forward. Not medical advice. Consult a healthcare planning specialist.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Scenario + Label */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Scenario</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scenario *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              required
            >
              <option value="">Select scenario…</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isBaseline ? ' (Baseline)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label *</label>
            <input
              type="text"
              placeholder="e.g. Base Case — Age 55 Early Retiree"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Pre-Medicare */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Pre-Medicare Costs</h2>
          <p className="text-xs text-slate-500">
            Costs paid before you become Medicare-eligible. Includes employer plan, marketplace, or COBRA.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Annual Premium ($)</label>
              <input
                type="number" min="0" step="100"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={annualPremium}
                onChange={(e) => setAnnualPremium(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Annual Out-of-Pocket ($)</label>
              <input
                type="number" min="0" step="100"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={annualOOP}
                onChange={(e) => setAnnualOOP(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Medicare */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Medicare</h2>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Medicare Eligibility Age (default: 65)
            </label>
            <input
              type="number" min="60" max="70"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={medicareAge}
              onChange={(e) => setMedicareAge(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {[
              { id: 'partB', label: 'Part B (Medical, ~$175/mo in 2024)', checked: includePartB, set: setIncludePartB },
              { id: 'partD', label: 'Part D (Prescription drugs, ~$35/mo in 2024)', checked: includePartD, set: setIncludePartD },
              { id: 'medigap', label: 'Medigap / Medicare Advantage supplement', checked: includeMedigap, set: setIncludeMedigap },
            ].map(({ id, label: lbl, checked, set }) => (
              <div key={id} className="flex items-center gap-2">
                <input
                  type="checkbox" id={id} checked={checked}
                  onChange={(e) => set(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor={id} className="text-sm text-slate-700">{lbl}</label>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Additional Annual OOP (dental, vision, hearing) ($)
            </label>
            <input
              type="number" min="0" step="100"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={medicareOOP}
              onChange={(e) => setMedicareOOP(e.target.value)}
            />
          </div>
        </div>

        {/* Healthcare inflation */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Healthcare Inflation</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Annual Healthcare Inflation Rate: <strong>{inflationRate}%</strong>
            </label>
            <input
              type="range" min="3" max="8" step="0.5"
              value={inflationRate}
              onChange={(e) => setInflationRate(e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>3% (low)</span>
              <span>5% (default)</span>
              <span>8% (high)</span>
            </div>
          </div>
        </div>

        {/* Spouse */}
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="includeSpouse"
              checked={includeSpouse}
              onChange={(e) => setIncludeSpouse(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="includeSpouse" className="font-semibold text-slate-900">
              Include Spouse Healthcare Costs
            </label>
          </div>
          {includeSpouse && (
            <p className="text-xs text-slate-500 mt-2 ml-7">
              Spouse costs will use the same pre-Medicare and Medicare configuration, applied at the
              spouse&apos;s respective age in each year.
            </p>
          )}
        </div>

        {/* LTC stress */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="ltcEnabled"
              checked={ltcEnabled}
              onChange={(e) => setLtcEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="ltcEnabled" className="font-semibold text-slate-900">
              Long-Term Care Stress Test
            </label>
          </div>
          {ltcEnabled && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Injects a multi-year LTC cost spike at a specified age. National median for
                assisted living is ~$60,000/yr; memory care ~$90,000+/yr (2024).
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Start Age</label>
                  <input
                    type="number" min="60" max="100"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={ltcStartAge}
                    onChange={(e) => setLtcStartAge(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Duration (yrs)</label>
                  <input
                    type="number" min="1" max="20"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={ltcDuration}
                    onChange={(e) => setLtcDuration(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Annual Cost ($)</label>
                  <input
                    type="number" min="0" step="5000"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={ltcAnnualCost}
                    onChange={(e) => setLtcAnnualCost(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Longevity stress */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="longevityEnabled"
              checked={longevityEnabled}
              onChange={(e) => setLongevityEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="longevityEnabled" className="font-semibold text-slate-900">
              Longevity Stress Test
            </label>
          </div>
          {longevityEnabled && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Extends the projection timeline to a target age, testing whether healthcare
                costs remain manageable if you live longer than expected.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Target Age</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={longevityTargetAge}
                    onChange={(e) => setLongevityTargetAge(e.target.value)}
                  >
                    <option value="90">Age 90</option>
                    <option value="95">Age 95</option>
                    <option value="100">Age 100</option>
                    <option value="105">Age 105</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Apply To</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={longevityPerson}
                    onChange={(e) => setLongevityPerson(e.target.value as 'primary' | 'spouse' | 'both')}
                  >
                    <option value="primary">Primary Person</option>
                    <option value="spouse">Spouse</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? 'Running analysis…' : 'Run Healthcare Analysis →'}
          </Button>
          <Link href="/app/healthcare-planning">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
