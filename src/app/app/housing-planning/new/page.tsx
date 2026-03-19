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

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const NO_INCOME_TAX_STATES = new Set(['AK','FL','NV','NH','SD','TN','TX','WY','WA']);

export default function NewHousingPlanningPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Base
  const [scenarioId, setScenarioId] = useState('');
  const [label, setLabel] = useState('');
  const [strategy, setStrategy] = useState<'stay_in_place' | 'downsize' | 'relocate'>('stay_in_place');

  // Current property
  const [currentValue, setCurrentValue] = useState('500000');
  const [mortgageBalance, setMortgageBalance] = useState('200000');
  const [annualHousingCost, setAnnualHousingCost] = useState('24000');
  const [annualMortgagePayment, setAnnualMortgagePayment] = useState('18000');
  const [appreciationRate, setAppreciationRate] = useState('3');

  // Downsizing
  const [dsEventYear, setDsEventYear] = useState(String(new Date().getFullYear() + 5));
  const [dsSalePrice, setDsSalePrice] = useState('600000');
  const [dsSellingCost, setDsSellingCost] = useState('6');
  const [dsMortgagePayoff, setDsMortgagePayoff] = useState('180000');
  const [dsBuyReplacement, setDsBuyReplacement] = useState(true);
  const [dsReplacementCost, setDsReplacementCost] = useState('350000');
  const [dsReplacementMortgage, setDsReplacementMortgage] = useState('0');
  const [dsPostMoveCost, setDsPostMoveCost] = useState('18000');
  const [dsMoveCost, setDsMoveCost] = useState('10000');

  // Relocation
  const [relEventYear, setRelEventYear] = useState(String(new Date().getFullYear() + 5));
  const [relState, setRelState] = useState('FL');
  const [relNewCost, setRelNewCost] = useState('20000');
  const [relMoveCost, setRelMoveCost] = useState('15000');
  const [relBuyReplacement, setRelBuyReplacement] = useState(true);
  const [relReplacementCost, setRelReplacementCost] = useState('400000');
  const [relReplacementMortgage, setRelReplacementMortgage] = useState('0');

  // Gifting
  const [giftingEnabled, setGiftingEnabled] = useState(false);
  const [annualGift, setAnnualGift] = useState('18000');
  const [oneTimeGiftYear, setOneTimeGiftYear] = useState('');
  const [oneTimeGiftAmount, setOneTimeGiftAmount] = useState('');

  // General
  const [inflationRate, setInflationRate] = useState('2.5');
  const [includeLegacy, setIncludeLegacy] = useState(true);

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
      strategy,
      currentProperty: {
        currentValue: Number(currentValue),
        mortgageBalance: Number(mortgageBalance),
        annualAppreciationRate: Number(appreciationRate) / 100,
        annualHousingCost: Number(annualHousingCost),
        annualMortgagePayment: Number(annualMortgagePayment),
      },
      downsizing: {
        enabled: strategy === 'downsize',
        eventYear: Number(dsEventYear),
        expectedSalePrice: Number(dsSalePrice),
        sellingCostPercent: Number(dsSellingCost) / 100,
        mortgagePayoffAmount: Number(dsMortgagePayoff),
        buyReplacementHome: dsBuyReplacement,
        replacementHomeCost: Number(dsReplacementCost),
        replacementHomeMortgage: Number(dsReplacementMortgage),
        postMoveAnnualHousingCost: Number(dsPostMoveCost),
        oneTimeMoveCost: Number(dsMoveCost),
      },
      relocation: {
        enabled: strategy === 'relocate',
        eventYear: Number(relEventYear),
        destinationState: relState,
        newAnnualHousingCost: Number(relNewCost),
        oneTimeMoveCost: Number(relMoveCost),
        buyReplacementHome: relBuyReplacement,
        replacementHomeCost: Number(relReplacementCost),
        replacementHomeMortgage: Number(relReplacementMortgage),
      },
      gifting: {
        enabled: giftingEnabled,
        annualGiftAmount: Number(annualGift),
        oneTimeGiftYear: oneTimeGiftYear ? Number(oneTimeGiftYear) : undefined,
        oneTimeGiftAmount: oneTimeGiftAmount ? Number(oneTimeGiftAmount) : undefined,
      },
      includeLegacyProjection: includeLegacy,
      generalInflationRate: Number(inflationRate) / 100,
    };

    try {
      const res = await fetch('/api/housing-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to run analysis.'); return; }
      router.push(`/app/housing-planning/${data.runId}`);
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
          <h1 className="text-2xl font-bold text-slate-900">New Housing Analysis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Model stay-in-place, downsizing, or relocation across your retirement.
          </p>
        </div>
        <Link href="/app/housing-planning">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Planning estimates only.</strong> Not real-estate, tax, or legal advice.
        Equity release and legacy figures are planning approximations only. Mortgage amortization uses a simplified model.
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
                <option key={s.id} value={s.id}>{s.name}{s.isBaseline ? ' (Baseline)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label *</label>
            <input
              type="text"
              placeholder="e.g. Downsize at 68 — No Replacement"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Strategy */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Housing Strategy</h2>
          {[
            { val: 'stay_in_place' as const, label: 'Stay in Place', desc: 'No housing move. Model current housing costs over retirement.' },
            { val: 'downsize' as const, label: 'Downsize', desc: 'Sell current home, optionally purchase a smaller replacement.' },
            { val: 'relocate' as const, label: 'Relocate', desc: 'Move to a new state/area with a different housing cost profile.' },
          ].map((opt) => (
            <label key={opt.val} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="strategy"
                value={opt.val}
                checked={strategy === opt.val}
                onChange={() => setStrategy(opt.val)}
                className="mt-1 h-4 w-4"
              />
              <div>
                <span className="font-medium text-slate-800 text-sm">{opt.label}</span>
                <p className="text-xs text-slate-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Current property */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Current Property</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Current Value ($)</label>
              <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mortgage Balance ($)</label>
              <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={mortgageBalance} onChange={(e) => setMortgageBalance(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Annual Housing Cost ($)</label>
              <input type="number" min="0" step="100" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={annualHousingCost} onChange={(e) => setAnnualHousingCost(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Annual Mortgage Payment ($)</label>
              <input type="number" min="0" step="100" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={annualMortgagePayment} onChange={(e) => setAnnualMortgagePayment(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Annual Appreciation Rate: <strong>{appreciationRate}%</strong>
            </label>
            <input type="range" min="0" max="6" step="0.5" value={appreciationRate} onChange={(e) => setAppreciationRate(e.target.value)} className="w-full" />
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>0%</span><span>3% (default)</span><span>6%</span></div>
          </div>
        </div>

        {/* Downsizing section */}
        {strategy === 'downsize' && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Downsizing Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Event Year</label>
                <input type="number" min="2024" max="2100" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsEventYear} onChange={(e) => setDsEventYear(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expected Sale Price ($)</label>
                <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsSalePrice} onChange={(e) => setDsSalePrice(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Selling Costs (%)</label>
                <input type="number" min="0" max="20" step="0.5" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsSellingCost} onChange={(e) => setDsSellingCost(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mortgage Payoff at Sale ($)</label>
                <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsMortgagePayoff} onChange={(e) => setDsMortgagePayoff(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">One-Time Move Cost ($)</label>
                <input type="number" min="0" step="500" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsMoveCost} onChange={(e) => setDsMoveCost(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Post-Move Annual Housing Cost ($)</label>
                <input type="number" min="0" step="100" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsPostMoveCost} onChange={(e) => setDsPostMoveCost(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="dsBuyReplacement" checked={dsBuyReplacement} onChange={(e) => setDsBuyReplacement(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="dsBuyReplacement" className="text-sm font-medium text-slate-700">Purchase replacement home</label>
            </div>
            {dsBuyReplacement && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Replacement Home Cost ($)</label>
                  <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsReplacementCost} onChange={(e) => setDsReplacementCost(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Replacement Mortgage ($)</label>
                  <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={dsReplacementMortgage} onChange={(e) => setDsReplacementMortgage(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Relocation section */}
        {strategy === 'relocate' && (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Relocation Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Event Year</label>
                <input type="number" min="2024" max="2100" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={relEventYear} onChange={(e) => setRelEventYear(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Destination State</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={relState} onChange={(e) => setRelState(e.target.value)}>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}{NO_INCOME_TAX_STATES.has(s) ? ' (no income tax)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Annual Housing Cost ($)</label>
                <input type="number" min="0" step="100" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={relNewCost} onChange={(e) => setRelNewCost(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">One-Time Move Cost ($)</label>
                <input type="number" min="0" step="500" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={relMoveCost} onChange={(e) => setRelMoveCost(e.target.value)} />
              </div>
            </div>
            {NO_INCOME_TAX_STATES.has(relState) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
                <strong>{relState}</strong> has no state income tax — this may reduce your state tax burden. Update your scenario&apos;s state tax assumption to reflect this.
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="relBuyReplacement" checked={relBuyReplacement} onChange={(e) => setRelBuyReplacement(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="relBuyReplacement" className="text-sm font-medium text-slate-700">Purchase home in new location</label>
            </div>
            {relBuyReplacement && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Replacement Home Cost ($)</label>
                  <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={relReplacementCost} onChange={(e) => setRelReplacementCost(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Replacement Mortgage ($)</label>
                  <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white" value={relReplacementMortgage} onChange={(e) => setRelReplacementMortgage(e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Gifting */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="giftingEnabled" checked={giftingEnabled} onChange={(e) => setGiftingEnabled(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="giftingEnabled" className="font-semibold text-slate-900">Annual Gifting</label>
          </div>
          {giftingEnabled && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Annual exclusion gifts reduce investable assets and projected estate. 2024 annual exclusion limit is $18,000 per recipient.
                Not a complete gift-tax analysis — consult a tax advisor.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Annual Gift Amount ($)</label>
                  <input type="number" min="0" step="1000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={annualGift} onChange={(e) => setAnnualGift(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">One-Time Gift Year (optional)</label>
                  <input type="number" min="2024" max="2100" placeholder="e.g. 2030" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={oneTimeGiftYear} onChange={(e) => setOneTimeGiftYear(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">One-Time Gift Amount ($) (optional)</label>
                  <input type="number" min="0" step="1000" placeholder="e.g. 50000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={oneTimeGiftAmount} onChange={(e) => setOneTimeGiftAmount(e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* General settings */}
        <div className="rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">General Settings</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Annual Inflation Rate: <strong>{inflationRate}%</strong>
            </label>
            <input type="range" min="1" max="5" step="0.5" value={inflationRate} onChange={(e) => setInflationRate(e.target.value)} className="w-full" />
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>1%</span><span>2.5% (default)</span><span>5%</span></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="includeLegacy" checked={includeLegacy} onChange={(e) => setIncludeLegacy(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="includeLegacy" className="text-sm font-medium text-slate-700">Include legacy / estate projection</label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} className="flex-1">
            {submitting ? 'Running analysis…' : 'Run Housing Analysis →'}
          </Button>
          <Link href="/app/housing-planning">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
