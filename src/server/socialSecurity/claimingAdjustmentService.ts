/**
 * Claiming Adjustment Service — Phase 8
 *
 * Translates SS benefit estimates at one claim age to another claim age.
 * Centralizes FRA (Full Retirement Age) and all adjustment formulas.
 *
 * All services that need the FRA must call getFullRetirementAge() from
 * this module — never hard-code 67 elsewhere.
 *
 * v1 Limitations:
 * - FRA fixed at 67 for those born 1960+ (does not vary by birth year cohort)
 * - Planning-grade adjustment rates, not SSA-exact actuarial values
 * - No WEP, GPO, deemed filing, or spousal-benefit strategies
 */

import { SS_BOUNDS } from './types';

// ---------------------------------------------------------------------------
// FRA — single source of truth
// ---------------------------------------------------------------------------

/**
 * Return the Full Retirement Age used by this engine.
 * All callers should use this function rather than referencing SS_BOUNDS directly.
 */
export function getFullRetirementAge(): number {
  return SS_BOUNDS.FULL_RETIREMENT_AGE;
}

// ---------------------------------------------------------------------------
// Core adjustment factor
// ---------------------------------------------------------------------------

/**
 * Compute the benefit adjustment multiplier for a given claim age vs. FRA.
 *
 * factor > 1.0  — delayed credit (claimed after FRA)
 * factor = 1.0  — claimed exactly at FRA
 * factor < 1.0  — early reduction (claimed before FRA)
 *
 * Months are computed using integer arithmetic to avoid floating-point drift
 * from fractional ages (e.g., 62.0, 66.5, 70.0).
 */
export function computeAdjustmentFactor(claimAge: number): number {
  const fra = getFullRetirementAge();
  const fraMonths = Math.round(fra * 12);
  const claimMonths = Math.round(claimAge * 12);
  const monthsDiff = claimMonths - fraMonths;

  if (monthsDiff === 0) return 1.0;

  if (monthsDiff < 0) {
    // Early claim: two-tier reduction
    const earlyMonths = -monthsDiff;
    const first36 = Math.min(earlyMonths, 36);
    const beyond36 = Math.max(0, earlyMonths - 36);
    const reductionFactor =
      first36 * SS_BOUNDS.EARLY_REDUCTION_RATE_FIRST_36 +
      beyond36 * SS_BOUNDS.EARLY_REDUCTION_RATE_BEYOND_36;
    return 1 - reductionFactor;
  } else {
    // Delayed credit (capped implicitly by MAX_CLAIM_AGE usage in callers)
    return 1 + monthsDiff * SS_BOUNDS.DELAYED_CREDIT_RATE_PER_MONTH;
  }
}

/**
 * Adjust a FRA-equivalent annual benefit for a given claim age.
 * Clamps claimAge to [MIN_CLAIM_AGE, MAX_CLAIM_AGE].
 *
 * @param fraAnnualBenefit   Annual benefit the member would receive at FRA
 * @param claimAge           Age at which the member actually claims
 */
export function adjustBenefitForClaimAge(
  fraAnnualBenefit: number,
  claimAge: number,
): number {
  const clamped = Math.max(
    SS_BOUNDS.MIN_CLAIM_AGE,
    Math.min(SS_BOUNDS.MAX_CLAIM_AGE, claimAge),
  );
  return fraAnnualBenefit * computeAdjustmentFactor(clamped);
}

// ---------------------------------------------------------------------------
// Back-calculation from stored claim age to FRA
// ---------------------------------------------------------------------------

/**
 * Recover the FRA-equivalent benefit from a benefit that was estimated at
 * a specific (possibly non-FRA) claim age.
 *
 * BenefitSource stores estimatedMonthlyBenefit at the stored claimAge.
 * This function normalizes that to FRA so alternative claim ages can be
 * evaluated via adjustBenefitForClaimAge().
 *
 * @param benefitAtKnownAge  Annual benefit at the stored claimAge
 * @param knownClaimAge      The claimAge for which that estimate was generated
 */
export function backCalculateFRABenefit(
  benefitAtKnownAge: number,
  knownClaimAge: number,
): number {
  const factor = computeAdjustmentFactor(
    Math.max(SS_BOUNDS.MIN_CLAIM_AGE, Math.min(SS_BOUNDS.MAX_CLAIM_AGE, knownClaimAge)),
  );
  if (factor === 0) return 0;
  return benefitAtKnownAge / factor;
}

/**
 * Convert a benefit estimated at one claim age to a benefit at a different
 * target claim age.
 *
 * Step 1: back-calculate to FRA.
 * Step 2: apply adjustment for targetClaimAge.
 *
 * @param benefitAtKnownAge  Annual benefit at the stored claimAge
 * @param knownClaimAge      The claimAge for which the stored benefit was estimated
 * @param targetClaimAge     The claim age we want to evaluate
 */
export function convertBenefitToClaimAge(
  benefitAtKnownAge: number,
  knownClaimAge: number,
  targetClaimAge: number,
): number {
  const fraEquivalent = backCalculateFRABenefit(benefitAtKnownAge, knownClaimAge);
  return adjustBenefitForClaimAge(fraEquivalent, targetClaimAge);
}

// ---------------------------------------------------------------------------
// Break-even calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the age at which cumulative lifetime benefits from claiming at
 * claimAge equals the cumulative lifetime benefits from claiming at FRA.
 *
 * Derivation:
 *   A = adjustedBenefit (benefit at claimAge)
 *   B = fraEquivalentBenefit (benefit at FRA)
 *   Break-even age T satisfies:
 *     A × (T − claimAge) = B × (T − FRA)
 *   ∴ T = (A × claimAge − B × FRA) / (A − B)
 *
 * Returns null when:
 * - claimAge ≈ FRA (no break-even exists)
 * - denominator is zero (degenerate)
 * - break-even is above 100 (practically unreachable)
 *
 * @param fraEquivalentBenefit  FRA-equivalent annual benefit
 * @param claimAge              The claim age to evaluate
 */
export function calculateBreakEvenAge(
  fraEquivalentBenefit: number,
  claimAge: number,
): number | null {
  const fra = getFullRetirementAge();
  if (Math.abs(claimAge - fra) < 0.01) return null;

  const clamped = Math.max(SS_BOUNDS.MIN_CLAIM_AGE, Math.min(SS_BOUNDS.MAX_CLAIM_AGE, claimAge));
  const adjustedBenefit = adjustBenefitForClaimAge(fraEquivalentBenefit, clamped);
  const denominator = adjustedBenefit - fraEquivalentBenefit;

  if (Math.abs(denominator) < 0.001) return null;

  const breakEvenAge =
    (adjustedBenefit * clamped - fraEquivalentBenefit * fra) / denominator;

  if (!isFinite(breakEvenAge) || breakEvenAge < 0 || breakEvenAge > 100) return null;
  return Math.round(breakEvenAge);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a claim age. Returns an error string or null if valid.
 */
export function validateClaimAge(claimAge: number): string | null {
  if (!Number.isFinite(claimAge)) return 'Claim age must be a number.';
  if (claimAge < SS_BOUNDS.MIN_CLAIM_AGE) {
    return `Claim age must be at least ${SS_BOUNDS.MIN_CLAIM_AGE}.`;
  }
  if (claimAge > SS_BOUNDS.MAX_CLAIM_AGE) {
    return `Claim age cannot exceed ${SS_BOUNDS.MAX_CLAIM_AGE} (no delayed credit beyond 70).`;
  }
  return null;
}
