'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type {
  SurvivorTransitionResult,
  CoupleRetirementCoordinationResult,
  SocialSecurityMemberSummary,
} from '@/server/socialSecurity/types';

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

interface SurvivorData {
  survivorTransition: SurvivorTransitionResult;
  coupleCoordination: CoupleRetirementCoordinationResult | null;
  memberSummaries: SocialSecurityMemberSummary[];
  runId: string;
  label: string;
}

function SurvivorContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get('runId') ?? '';

  const [data, setData] = useState<SurvivorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setError('No runId provided. Select an SS run from the Social Security page.');
      setLoading(false);
      return;
    }
    fetch(`/api/survivor-income?runId=${runId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setData(d as SurvivorData);
      })
      .catch(() => setError('Failed to load survivor income data.'))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading...</div>;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <div className="text-red-600 py-8 text-center">{error ?? 'No data found.'}</div>
        <div className="text-center">
          <Link href="/app/social-security">
            <Button variant="outline">Go to Social Security Planning</Button>
          </Link>
        </div>
      </div>
    );
  }

  const st = data.survivorTransition;
  const coord = data.coupleCoordination;
  const gap = st.annualGapAfterTransition;
  const hasGap = gap > 0;

  const deceasedMember = data.memberSummaries.find((m) => m.memberId === st.deceasedMemberId);
  const survivingMember = data.memberSummaries.find((m) => m.memberId === st.survivingMemberId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Survivor Income Analysis</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data.label} · From:{' '}
            <Link href={`/app/social-security/${runId}`} className="text-blue-600 hover:underline">
              SS run
            </Link>
          </p>
        </div>
        <Link href="/app/social-security">
          <Button variant="outline" size="sm">← Back</Button>
        </Link>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
        <strong>Survivor rule:</strong> When one spouse dies, the surviving spouse retains
        whichever Social Security benefit is higher — their own or the deceased spouse's.
        Household expenses are assumed to be {fmtPct(st.survivorExpenseRatio)} of the couple's
        retirement expenses.
      </div>

      {/* Transition event */}
      <div className="rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Transition Event (Year {st.transitionYear})</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-400">Deceased Member</div>
            <div className="font-medium">{deceasedMember?.firstName ?? st.deceasedMemberId}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Surviving Member</div>
            <div className="font-medium">{survivingMember?.firstName ?? st.survivingMemberId}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Deceased's SS Benefit at Death</div>
            <div className="font-medium">{fmt(st.deceasedBenefitAtDeath)}/yr</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Survivor's Own SS Benefit</div>
            <div className="font-medium">{fmt(st.survivingOwnBenefit)}/yr</div>
          </div>
        </div>
      </div>

      {/* Survivor income summary */}
      <div className="rounded-xl border border-purple-200 bg-white p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Survivor Income Summary</h3>
        <div className="grid grid-cols-1 gap-4 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <div className="text-xs text-slate-400">Survivor SS Benefit (retained)</div>
              <div className="text-xs text-slate-400 mt-0.5">Higher of two benefits above</div>
            </div>
            <div className="text-xl font-bold text-blue-700">{fmt(st.survivorBenefit)}/yr</div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <div className="text-xs text-slate-400">Projected Survivor Expenses</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {fmtPct(st.survivorExpenseRatio)} × {fmt(st.coupleAnnualExpensesAtTransition)} couple expenses
              </div>
            </div>
            <div className="text-xl font-bold text-slate-700">{fmt(st.projectedAnnualSurvivorExpenses)}/yr</div>
          </div>

          <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${hasGap ? 'bg-red-50' : 'bg-green-50'}`}>
            <div>
              <div className={`text-xs ${hasGap ? 'text-red-400' : 'text-green-400'}`}>
                Annual {hasGap ? 'Shortfall' : 'Surplus'}
              </div>
              <div className={`text-xs mt-0.5 ${hasGap ? 'text-red-500' : 'text-green-500'}`}>
                {hasGap
                  ? 'SS income does not cover survivor expenses — portfolio withdrawals needed'
                  : 'SS income covers survivor expenses — no portfolio withdrawal required'}
              </div>
            </div>
            <div className={`text-xl font-bold ${hasGap ? 'text-red-700' : 'text-green-700'}`}>
              {hasGap ? fmt(gap) : fmt(-gap)}
            </div>
          </div>
        </div>
      </div>

      {/* Couple coordination summary */}
      {coord && (
        <div className="rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Benefit Timeline Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400">Years Both Receiving SS</div>
              <div className="font-medium">{coord.yearsWithBothBenefits} years</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Years in Survivor Phase</div>
              <div className="font-medium">{coord.yearsInSurvivorPhase} years</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Primary Claim Year</div>
              <div className="font-medium">{coord.primaryClaimYear}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Spouse Claim Year</div>
              <div className="font-medium">{coord.spouseClaimYear}</div>
            </div>
          </div>
        </div>
      )}

      {/* Per-member SS summary */}
      {data.memberSummaries.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">SS Benefits by Member</h3>
          <div className="space-y-3">
            {data.memberSummaries.map((ms) => (
              <div key={ms.memberId} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{ms.firstName}</span>
                  <span className="text-xs text-slate-400 ml-2">claims at {ms.claimAge}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono">{fmt(ms.adjustedAnnualBenefit)}/yr</div>
                  <div className="text-xs text-slate-400">Lifetime: {fmt(ms.totalLifetimeBenefit)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        Planning-grade model. Survivor benefit rule: surviving spouse retains the higher of the two SS
        streams. Survivor expense ratio is configurable. Not SSA-certified.
      </div>
    </div>
  );
}

export default function SurvivorIncomePage() {
  return (
    <Suspense fallback={<div className="text-slate-400 py-12 text-center">Loading...</div>}>
      <SurvivorContent />
    </Suspense>
  );
}
