/**
 * Social Security Comparison Service — Phase 8
 *
 * Compares two Social Security planning runs side-by-side, highlighting
 * claim-age differences and outcome deltas.
 */

import type {
  SocialSecurityPlanningRunResult,
  SocialSecurityClaimComparisonResult,
} from './types';

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDiff(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.round(n).toLocaleString()}`;
}

/**
 * Compare two Social Security planning runs and produce a structured diff.
 *
 * Outcome direction conventions:
 * - 'better': Run B has a higher (more beneficial) value for this metric
 * - 'worse': Run B has a lower (less beneficial) value for this metric
 * - 'neutral': No material difference (within $1)
 */
export function compareSocialSecurityRuns(
  runA: SocialSecurityPlanningRunResult,
  runB: SocialSecurityPlanningRunResult,
): SocialSecurityClaimComparisonResult {
  // ---- Claim age diffs ----
  const claimAgeDiffs: SocialSecurityClaimComparisonResult['claimAgeDiffs'] = [];

  for (const summaryA of runA.memberSummaries) {
    const summaryB = runB.memberSummaries.find((s) => s.memberId === summaryA.memberId);
    if (!summaryB) continue;
    claimAgeDiffs.push({
      memberId: summaryA.memberId,
      firstName: summaryA.firstName,
      claimAgeA: summaryA.claimAge,
      claimAgeB: summaryB.claimAge,
      adjustmentFactorA: summaryA.adjustmentFactor,
      adjustmentFactorB: summaryB.adjustmentFactor,
    });
  }

  // ---- Outcome diffs ----
  const outcomeDiffs: SocialSecurityClaimComparisonResult['outcomeDiffs'] = [];

  // Total household lifetime benefit
  const totalDelta = runB.totalHouseholdLifetimeBenefit - runA.totalHouseholdLifetimeBenefit;
  outcomeDiffs.push({
    label: 'Total Household Lifetime SS Benefit',
    a: fmt(runA.totalHouseholdLifetimeBenefit),
    b: fmt(runB.totalHouseholdLifetimeBenefit),
    delta: fmtDiff(totalDelta),
    direction: Math.abs(totalDelta) < 1 ? 'neutral' : totalDelta > 0 ? 'better' : 'worse',
  });

  // Per-member benefit comparison
  for (const summaryA of runA.memberSummaries) {
    const summaryB = runB.memberSummaries.find((s) => s.memberId === summaryA.memberId);
    if (!summaryB) continue;

    const memberDelta = summaryB.totalLifetimeBenefit - summaryA.totalLifetimeBenefit;
    outcomeDiffs.push({
      label: `${summaryA.firstName} Lifetime SS Benefit`,
      a: fmt(summaryA.totalLifetimeBenefit),
      b: fmt(summaryB.totalLifetimeBenefit),
      delta: fmtDiff(memberDelta),
      direction: Math.abs(memberDelta) < 1 ? 'neutral' : memberDelta > 0 ? 'better' : 'worse',
    });

    const adjustedDelta = summaryB.adjustedAnnualBenefit - summaryA.adjustedAnnualBenefit;
    outcomeDiffs.push({
      label: `${summaryA.firstName} Annual Benefit at Claim Age`,
      a: fmt(summaryA.adjustedAnnualBenefit),
      b: fmt(summaryB.adjustedAnnualBenefit),
      delta: fmtDiff(adjustedDelta),
      direction: Math.abs(adjustedDelta) < 1 ? 'neutral' : adjustedDelta > 0 ? 'better' : 'worse',
    });
  }

  // Survivor transition comparison (if both runs have it)
  if (runA.survivorTransition && runB.survivorTransition) {
    const aSurvivor = runA.survivorTransition;
    const bSurvivor = runB.survivorTransition;

    const benefitDelta = bSurvivor.survivorBenefit - aSurvivor.survivorBenefit;
    outcomeDiffs.push({
      label: 'Survivor SS Benefit',
      a: fmt(aSurvivor.survivorBenefit),
      b: fmt(bSurvivor.survivorBenefit),
      delta: fmtDiff(benefitDelta),
      direction: Math.abs(benefitDelta) < 1 ? 'neutral' : benefitDelta > 0 ? 'better' : 'worse',
    });

    const gapDelta = bSurvivor.annualGapAfterTransition - aSurvivor.annualGapAfterTransition;
    outcomeDiffs.push({
      label: 'Annual Survivor Income Gap (lower = better)',
      a: fmt(aSurvivor.annualGapAfterTransition),
      b: fmt(bSurvivor.annualGapAfterTransition),
      delta: fmtDiff(gapDelta),
      // Smaller gap is better → if B is smaller (negative delta), that's 'better'
      direction: Math.abs(gapDelta) < 1 ? 'neutral' : gapDelta < 0 ? 'better' : 'worse',
    });
  }

  return { runA, runB, claimAgeDiffs, outcomeDiffs };
}
