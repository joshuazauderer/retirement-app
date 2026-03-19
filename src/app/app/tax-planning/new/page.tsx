'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Scenario { id: string; name: string; isBaseline: boolean; }

export default function NewTaxAnalysisPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [scenarioId, setScenarioId] = useState('');
  const [label, setLabel] = useState('');
  const [orderingType, setOrderingType] = useState('TAXABLE_FIRST');
  const [basisRatio, setBasisRatio] = useState('60');
  const [useRoth, setUseRoth] = useState(false);
  const [conversionAmount, setConversionAmount] = useState('25000');
  const [rothStart, setRothStart] = useState(String(new Date().getFullYear()));
  const [rothEnd, setRothEnd] = useState(String(new Date().getFullYear() + 5));

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
    setSubmitting(true);

    const body = {
      scenarioId,
      label: label || undefined,
      withdrawalOrderingType: orderingType,
      taxAssumptions: {
        capitalGainsBasisRatio: Math.max(0, Math.min(1, Number(basisRatio) / 100)),
        rothConversion: useRoth ? {
          annualConversionAmount: Number(conversionAmount),
          startYear: Number(rothStart),
          endYear: Number(rothEnd),
        } : undefined,
      },
    };

    try {
      const res = await fetch('/api/tax-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to run analysis.'); return; }
      router.push(`/app/tax-planning/${data.run.runId}`);
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
          <h1 className="text-2xl font-bold text-slate-900">New Tax Analysis</h1>
          <p className="text-slate-500 text-sm mt-1">Configure and run a tax-aware retirement projection.</p>
        </div>
        <Link href="/app/tax-planning"><Button variant="outline" size="sm">← Back</Button></Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimates.</strong> Federal brackets use 2024 values inflated forward.
        State taxes use simplified flat effective rates. Not tax preparation software.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Scenario */}
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
                <option key={s.id} value={s.id}>{s.name}{s.isBaseline ? ' (Baseline)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label (optional)</label>
            <input
              type="text"
              placeholder="e.g. Taxable First — No Conversion"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        {/* Withdrawal ordering */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Withdrawal Ordering</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account Withdrawal Order</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={orderingType}
              onChange={(e) => setOrderingType(e.target.value)}
            >
              <option value="TAXABLE_FIRST">Taxable First → Tax-Deferred → Tax-Free</option>
              <option value="TAX_DEFERRED_FIRST">Tax-Deferred First → Taxable → Tax-Free</option>
              <option value="TAX_FREE_FIRST">Tax-Free First → Taxable → Tax-Deferred</option>
              <option value="PRO_RATA">Pro-Rata Across All Accounts</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Different ordering strategies affect which accounts are drawn first and therefore affect taxes.
            </p>
          </div>
        </div>

        {/* Capital gains */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Capital Gains Assumption</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cost Basis Ratio of Taxable Accounts: <strong>{basisRatio}%</strong>
            </label>
            <input
              type="range" min="0" max="100" step="5"
              value={basisRatio}
              onChange={(e) => setBasisRatio(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-slate-400 mt-1">
              {basisRatio}% of your taxable account balance is treated as cost basis (return of principal — not taxable on withdrawal).
              The remaining {100 - Number(basisRatio)}% is treated as unrealized gain (taxed at capital gains rates when withdrawn).
            </p>
          </div>
        </div>

        {/* Roth conversion */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useRoth"
              checked={useRoth}
              onChange={(e) => setUseRoth(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="useRoth" className="font-semibold text-slate-900">Include Roth Conversion Strategy</label>
          </div>
          {useRoth && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Models annual conversions from tax-deferred to tax-free accounts. Conversion income is
                added to ordinary income in each conversion year, increasing near-term taxes but
                potentially reducing future taxes on account withdrawals.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Annual Conversion ($)</label>
                  <input
                    type="number" min="0" step="1000"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    value={conversionAmount}
                    onChange={(e) => setConversionAmount(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Start Year</label>
                    <input
                      type="number" min="2020" max="2100"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      value={rothStart}
                      onChange={(e) => setRothStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">End Year</label>
                    <input
                      type="number" min="2020" max="2100"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      value={rothEnd}
                      onChange={(e) => setRothEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? 'Running analysis…' : 'Run Tax Analysis →'}
          </Button>
          <Link href="/app/tax-planning">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
