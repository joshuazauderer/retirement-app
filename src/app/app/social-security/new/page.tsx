'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ScenarioSummary } from '@/server/scenarios/types';
import { SS_BOUNDS } from '@/server/socialSecurity/types';

interface MemberInfo {
  memberId: string;
  firstName: string;
  isPrimary: boolean;
  currentClaimAge: number | null;
}

export default function NewSocialSecurityPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('');
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [claimAgeOverrides, setClaimAgeOverrides] = useState<Record<string, string>>({});
  const [survivorExpenseRatio, setSurvivorExpenseRatio] = useState('80');
  const [label, setLabel] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load scenarios
    fetch('/api/scenarios')
      .then((r) => r.json())
      .then((d) => {
        const list: ScenarioSummary[] = d.scenarios ?? [];
        setScenarios(list);
        const baseline = list.find((s) => s.isBaseline);
        if (baseline) setScenarioId(baseline.id);
      });

    // Load household members + their existing benefit sources
    fetch('/api/benefits')
      .then((r) => r.json())
      .then((d) => {
        const benefits: Array<{
          householdMemberId: string;
          firstName: string;
          isPrimary: boolean;
          claimAge: number;
          type: string;
        }> = d.benefits ?? [];

        const ssByMember = new Map<string, MemberInfo>();
        for (const b of benefits) {
          if (b.type === 'SOCIAL_SECURITY' && !ssByMember.has(b.householdMemberId)) {
            ssByMember.set(b.householdMemberId, {
              memberId: b.householdMemberId,
              firstName: b.firstName,
              isPrimary: b.isPrimary,
              currentClaimAge: b.claimAge,
            });
          }
        }
        const list = Array.from(ssByMember.values());
        setMembers(list);

        // Initialize claim age fields
        const initial: Record<string, string> = {};
        for (const m of list) {
          initial[m.memberId] = String(m.currentClaimAge ?? SS_BOUNDS.FULL_RETIREMENT_AGE);
        }
        setClaimAgeOverrides(initial);
      })
      .catch(() => {
        // Benefits endpoint may not exist yet — show empty form
      });
  }, []);

  const handleRun = async () => {
    if (!scenarioId) { setError('Please select a scenario.'); return; }
    setRunning(true); setError(null);

    const overrides: Record<string, number> = {};
    for (const [memberId, ageStr] of Object.entries(claimAgeOverrides)) {
      const age = parseInt(ageStr, 10);
      if (!isNaN(age)) overrides[memberId] = age;
    }

    const body = {
      scenarioId,
      label: label || undefined,
      claimAgeOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      survivorExpenseRatio: parseFloat(survivorExpenseRatio) / 100,
    };

    try {
      const res = await fetch('/api/social-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to run analysis.'); return; }
      router.push(`/app/social-security/${data.run.runId}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  const fra = SS_BOUNDS.FULL_RETIREMENT_AGE;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Social Security Analysis</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Model claiming at different ages and see how it affects your lifetime benefit
          and survivor income.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Planning-grade model.</strong> FRA = 67 (born 1960+). Adjustment is approximate:
        ~5/9% per month for first 36 months early, ~5/12% beyond; ~2/3% per month late (max age 70).
        Results are for educational planning use only — not SSA-certified.
      </div>

      <div className="space-y-5">
        {/* Scenario */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Scenario</label>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a scenario...</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isBaseline ? ' (Baseline)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Label <span className="text-slate-400 font-normal">optional</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Both claim at 70"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Claim age overrides */}
        {members.length > 0 ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Claim Ages <span className="text-slate-400 font-normal text-xs">(62–70)</span>
            </label>
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.memberId} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium text-slate-700">
                    {m.firstName}{m.isPrimary ? '' : ' (Spouse)'}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={SS_BOUNDS.MIN_CLAIM_AGE}
                      max={SS_BOUNDS.MAX_CLAIM_AGE}
                      step={1}
                      value={claimAgeOverrides[m.memberId] ?? fra}
                      onChange={(e) =>
                        setClaimAgeOverrides((prev) => ({
                          ...prev,
                          [m.memberId]: e.target.value,
                        }))
                      }
                      className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-400">
                      {parseInt(claimAgeOverrides[m.memberId] ?? String(fra)) < fra
                        ? `Early (reduced benefit)`
                        : parseInt(claimAgeOverrides[m.memberId] ?? String(fra)) > fra
                          ? `Delayed (increased benefit)`
                          : `At FRA (full benefit)`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              FRA = {fra}. Claiming before FRA reduces your benefit; after FRA increases it (up to 70).
              These override the claim ages stored in your Benefits profile.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <strong>No Social Security benefits found.</strong>{' '}
            Add SS benefit sources in{' '}
            <a href="/app/benefits" className="underline">Benefits</a>{' '}
            first. The analysis will run using claim ages from your benefit profile, or you can
            still run a scenario-level analysis below.
          </div>
        )}

        {/* Survivor expense ratio (couples) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Survivor Expense Ratio (%){' '}
            <span className="text-slate-400 font-normal text-xs">couple households only</span>
          </label>
          <input
            type="number"
            min={10}
            max={100}
            step={5}
            value={survivorExpenseRatio}
            onChange={(e) => setSurvivorExpenseRatio(e.target.value)}
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            Fraction of couple retirement expenses assumed to continue after one spouse dies.
            Default 80%.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleRun} disabled={running || !scenarioId}>
          {running ? 'Running analysis...' : '▶ Run Analysis'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/app/social-security')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
