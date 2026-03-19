'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type {
  SocialSecurityPlanningRunResult,
  SocialSecurityMemberSummary,
  SurvivorTransitionResult,
} from '@/server/socialSecurity/types';

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function AdjustmentBadge({ factor }: { factor: number }) {
  const pct = ((factor - 1) * 100).toFixed(1);
  const color = factor < 1 ? 'text-red-700 bg-red-50' : factor > 1 ? 'text-green-700 bg-green-50' : 'text-slate-700 bg-slate-50';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {factor >= 1 ? '+' : ''}{pct}%
    </span>
  );
}

function MemberCard({ summary }: { summary: SocialSecurityMemberSummary }) {
  return (
    <div className="rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{summary.firstName}</h3>
        <AdjustmentBadge factor={summary.adjustmentFactor} />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <div className="text-slate-400 text-xs">Full Retirement Age</div>
          <div className="font-medium">{summary.fra}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Claim Age (this run)</div>
          <div className="font-medium">{summary.claimAge}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">FRA-Equivalent Annual Benefit</div>
          <div className="font-medium">{fmt(summary.fraEquivalentAnnualBenefit)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Adjusted Annual Benefit</div>
          <div className="font-medium text-blue-700">{fmt(summary.adjustedAnnualBenefit)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Lifetime SS Benefit</div>
          <div className="font-medium">{fmt(summary.totalLifetimeBenefit)}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">Break-Even vs. FRA</div>
          <div className="font-medium">
            {summary.breakEvenAgeVsFRA !== null
              ? `Age ${summary.breakEvenAgeVsFRA}`
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

function SurvivorCard({ st }: { st: SurvivorTransitionResult }) {
  const gap = st.annualGapAfterTransition;
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 space-y-3">
      <h3 className="font-semibold text-purple-900">Survivor Income Analysis</h3>
      <p className="text-xs text-purple-700">
        Transition year: {st.transitionYear} — surviving member retains the higher of the two SS benefits.
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <div className="text-purple-400 text-xs">Deceased Member Benefit</div>
          <div className="font-medium">{fmt(st.deceasedBenefitAtDeath)}/yr</div>
        </div>
        <div>
          <div className="text-purple-400 text-xs">Surviving Own Benefit</div>
          <div className="font-medium">{fmt(st.survivingOwnBenefit)}/yr</div>
        </div>
        <div>
          <div className="text-purple-400 text-xs">Survivor Benefit (retained)</div>
          <div className="font-semibold text-purple-900">{fmt(st.survivorBenefit)}/yr</div>
        </div>
        <div>
          <div className="text-purple-400 text-xs">Survivor Expense Ratio</div>
          <div className="font-medium">{fmtPct(st.survivorExpenseRatio)}</div>
        </div>
        <div>
          <div className="text-purple-400 text-xs">Projected Survivor Expenses</div>
          <div className="font-medium">{fmt(st.projectedAnnualSurvivorExpenses)}/yr</div>
        </div>
        <div>
          <div className="text-purple-400 text-xs">Annual Income Gap</div>
          <div className={`font-semibold ${gap > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {gap > 0 ? fmt(gap) + ' shortfall' : fmt(-gap) + ' surplus'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialSecurityRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<SocialSecurityPlanningRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/social-security/${runId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setRun(d.run);
      })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="text-slate-400 py-12 text-center">Loading...</div>;
  if (error || !run) return (
    <div className="text-red-600 py-12 text-center">
      {error ?? 'SS run not found.'}
      <div className="mt-4"><Link href="/app/social-security"><Button variant="outline">Back</Button></Link></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{run.label}</h1>
          <p className="text-slate-500 text-sm mt-1">
            Scenario: {run.scenarioName} · {new Date(run.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/social-security">
            <Button variant="outline" size="sm">← Back</Button>
          </Link>
          <Link href="/app/social-security/new">
            <Button size="sm">+ New Analysis</Button>
          </Link>
        </div>
      </div>

      {/* Summary banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="text-xs text-slate-400 mb-1">Total Household Lifetime SS Benefit</div>
        <div className="text-3xl font-bold text-blue-700">{fmt(run.totalHouseholdLifetimeBenefit)}</div>
        <div className="text-xs text-slate-400 mt-1">
          {run.projectionStartYear}–{run.projectionEndYear}
        </div>
      </div>

      {/* Member cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {run.memberSummaries.map((ms) => (
          <MemberCard key={ms.memberId} summary={ms} />
        ))}
      </div>

      {/* Couple coordination */}
      {run.coupleCoordination && (
        <div className="rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Couple Coordination</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400">Primary Retirement</div>
              <div className="font-medium">{run.coupleCoordination.primaryRetirementYear}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Spouse Retirement</div>
              <div className="font-medium">{run.coupleCoordination.spouseRetirementYear}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Years Both Claim</div>
              <div className="font-medium">{run.coupleCoordination.yearsWithBothBenefits}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Years in Survivor Phase</div>
              <div className="font-medium">{run.coupleCoordination.yearsInSurvivorPhase}</div>
            </div>
          </div>
        </div>
      )}

      {/* Survivor transition */}
      {run.survivorTransition && <SurvivorCard st={run.survivorTransition} />}

      {/* Year-by-year table */}
      {run.yearByYear.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Year-by-Year SS Benefits</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Year</th>
                  {run.memberSummaries.map((ms) => (
                    <th key={ms.memberId} className="px-3 py-2 text-right text-xs font-medium text-slate-500">
                      {ms.firstName}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Household Total</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Expenses</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Phase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {run.yearByYear.filter((_, i) => i % 1 === 0).slice(0, 50).map((yr) => (
                  <tr key={yr.year} className={yr.isSurvivorPhase ? 'bg-purple-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{yr.year}</td>
                    {run.memberSummaries.map((ms) => {
                      const mr = yr.memberResults.find((r) => r.memberId === ms.memberId);
                      return (
                        <td key={ms.memberId} className="px-3 py-2 text-right font-mono text-xs">
                          {mr?.alive
                            ? mr.effectiveBenefit > 0
                              ? fmt(mr.effectiveBenefit)
                              : <span className="text-slate-300">—</span>
                            : <span className="text-slate-300">deceased</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-xs font-medium">
                      {fmt(yr.totalHouseholdBenefit)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                      {yr.isSurvivorPhase && yr.survivorExpenses > 0
                        ? fmt(yr.survivorExpenses)
                        : fmt(yr.projectedExpenses)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {yr.isSurvivorPhase ? (
                        <span className="text-purple-600 font-medium">Survivor</span>
                      ) : 'Both alive'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        Planning-grade model. FRA = 67. Annual time-step. Not SSA-certified.
      </div>
    </div>
  );
}
