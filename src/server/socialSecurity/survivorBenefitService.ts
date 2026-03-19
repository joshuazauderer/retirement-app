/**
 * Survivor Benefit Service — Phase 8
 *
 * Computes survivor SS benefit retention and survivor expense adjustment.
 *
 * Survivor rule (simplified):
 *   The surviving spouse retains whichever SS benefit stream is higher —
 *   their own benefit or the deceased member's benefit.
 *
 * Survivor expense rule:
 *   The surviving spouse's retirement expenses are assumed to be
 *   survivorExpenseRatio × couple's retirement expenses (default: 80%).
 */

import { SS_BOUNDS } from './types';

// ---------------------------------------------------------------------------
// Survivor benefit computation
// ---------------------------------------------------------------------------

/**
 * Compute the survivor benefit for the surviving member.
 *
 * The surviving spouse retains the higher of:
 * - their own SS benefit (possibly 0 if not yet claimed)
 * - the deceased member's SS benefit at the time of death
 *
 * @param survivingMemberBenefit  The surviving member's own annual SS benefit
 *                                at the transition year (0 if not yet claimed)
 * @param deceasedMemberBenefit   The deceased member's annual SS benefit
 *                                at the transition year (post-COLA)
 * @returns                       The annual survivor benefit (higher of the two)
 */
export function computeSurvivorBenefit(
  survivingMemberBenefit: number,
  deceasedMemberBenefit: number,
): number {
  return Math.max(survivingMemberBenefit, deceasedMemberBenefit);
}

// ---------------------------------------------------------------------------
// Survivor expense computation
// ---------------------------------------------------------------------------

/**
 * Compute the survivor's annual expenses in the post-transition phase.
 *
 * @param coupleAnnualExpenses  The couple's total annual retirement expenses
 *                              at the transition year (inflation-adjusted)
 * @param survivorExpenseRatio  Fraction of couple expenses the survivor needs.
 *                              Defaults to SS_BOUNDS.DEFAULT_SURVIVOR_EXPENSE_RATIO (0.80).
 * @returns                     Survivor's estimated annual expenses
 */
export function computeSurvivorExpenses(
  coupleAnnualExpenses: number,
  survivorExpenseRatio: number = SS_BOUNDS.DEFAULT_SURVIVOR_EXPENSE_RATIO,
): number {
  const ratio = Math.max(0, Math.min(1, survivorExpenseRatio));
  return coupleAnnualExpenses * ratio;
}

// ---------------------------------------------------------------------------
// Survivor income gap
// ---------------------------------------------------------------------------

/**
 * Compute the annual income gap in the survivor phase.
 *
 * Positive result → shortfall (survivor SS income < survivor expenses).
 * Negative result → surplus (survivor SS income > survivor expenses).
 *
 * @param survivorBenefit          Annual SS benefit available to the survivor
 * @param survivorAnnualExpenses   Survivor's estimated annual expenses
 */
export function computeSurvivorIncomeGap(
  survivorBenefit: number,
  survivorAnnualExpenses: number,
): number {
  return survivorAnnualExpenses - survivorBenefit;
}

// ---------------------------------------------------------------------------
// COLA projection helper
// ---------------------------------------------------------------------------

/**
 * Apply COLA growth to a benefit for a number of years.
 *
 * @param baseBenefit    Annual benefit in the first year of claiming
 * @param colaRate       Annual cost-of-living adjustment rate (e.g. 0.023)
 * @param yearsActive    Number of years since claim start (0 = first year, no COLA yet)
 */
export function applyColaBenefit(
  baseBenefit: number,
  colaRate: number,
  yearsActive: number,
): number {
  if (yearsActive <= 0) return baseBenefit;
  return baseBenefit * Math.pow(1 + colaRate, yearsActive);
}
