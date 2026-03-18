/**
 * Withdrawal Policy Engine — Phase 7
 *
 * Computes the effective annual withdrawal target for a given year based on
 * the selected withdrawal strategy. This is a pure-function layer: it receives
 * current-year state and returns a structured instruction. No I/O or DB access.
 *
 * The engine calls this once per retirement year, between computing the
 * cash-flow gap (Step 8) and executing withdrawals (Step 9).
 *
 * v1 limitations:
 * - Guardrail uses portfolio-value ratio vs. initial retirement value (simple approximation).
 * - No dynamic spending floor based on essential expenses vs. discretionary split.
 * - Inflation is applied uniformly; no segmented bucket inflation modeling.
 */

import type {
  WithdrawalStrategyConfig,
  WithdrawalStrategyType,
  WithdrawalYearInstruction,
  GuardrailConfig,
} from './types';

// ---------------------------------------------------------------------------
// Mutable policy state — maintained by the engine loop across years
// ---------------------------------------------------------------------------

export interface PolicyEngineState {
  /** Year the primary member first entered retirement. */
  retirementStartYear: number | null;
  /** Total portfolio value at the first retirement year (for guardrail thresholds). */
  initialPortfolioValue: number;
  /**
   * The withdrawal target used in the prior retirement year.
   * Carries forward for GUARDRAIL strategy continuity.
   */
  currentYearTarget: number;
}

/** Create a fresh policy state (call once before the projection loop). */
export function createPolicyEngineState(): PolicyEngineState {
  return {
    retirementStartYear: null,
    initialPortfolioValue: 0,
    currentYearTarget: 0,
  };
}

/**
 * Called on the first retirement year to initialize state.
 * Must be called before the first computeWithdrawalInstruction() call
 * for any year when the member is retired.
 */
export function initializePolicyStateAtRetirement(
  state: PolicyEngineState,
  year: number,
  portfolioValue: number,
  config: WithdrawalStrategyConfig
): void {
  if (state.retirementStartYear !== null) return; // already initialized

  state.retirementStartYear = year;
  state.initialPortfolioValue = portfolioValue;

  switch (config.strategyType) {
    case 'GUARDRAIL':
      state.currentYearTarget =
        config.guardrailConfig?.initialAnnualWithdrawal ?? 0;
      break;
    case 'FIXED_NOMINAL':
      state.currentYearTarget = config.annualWithdrawalTarget ?? 0;
      break;
    case 'FIXED_REAL':
      state.currentYearTarget = config.annualWithdrawalTarget ?? 0;
      break;
    default:
      state.currentYearTarget = 0; // needs-based: computed from gap each year
  }
}

/**
 * Updates mutable state after a year's instruction is finalized.
 * Must be called at the end of each retirement year's loop iteration.
 */
export function advancePolicyState(
  state: PolicyEngineState,
  instruction: WithdrawalYearInstruction
): void {
  state.currentYearTarget = instruction.targetWithdrawal;
}

// ---------------------------------------------------------------------------
// Core: compute this year's withdrawal instruction
// ---------------------------------------------------------------------------

/**
 * Returns the withdrawal instruction for the current year.
 *
 * @param config        The strategy configuration (immutable).
 * @param year          The calendar year being processed.
 * @param state         Mutable policy state (read here; updated by advancePolicyState).
 * @param needsBasedGap The cash-flow gap from the engine (what's needed to cover expenses).
 * @param beginningPortfolioValue Portfolio value at the START of this year (before growth).
 * @param inflationRate Annual inflation rate (decimal, e.g. 0.03).
 * @param isMemberRetired Whether the primary member is retired this year.
 */
export function computeWithdrawalInstruction(
  config: WithdrawalStrategyConfig,
  year: number,
  state: PolicyEngineState,
  needsBasedGap: number,
  beginningPortfolioValue: number,
  inflationRate: number,
  isMemberRetired: boolean
): WithdrawalYearInstruction {
  // Pre-retirement or no policy: always needs-based
  if (!isMemberRetired || state.retirementStartYear === null) {
    return {
      year,
      targetWithdrawal: needsBasedGap,
      isNeedsBased: true,
      guardrailActive: false,
      guardrailDirection: 'none',
      inflationFactor: 1,
    };
  }

  const yearsInRetirement = year - state.retirementStartYear;
  const inflationFactor = Math.pow(1 + inflationRate, yearsInRetirement);

  switch (config.strategyType) {
    case 'NEEDS_BASED':
    case 'INFLATION_ADJUSTED_SPENDING':
      return {
        year,
        targetWithdrawal: needsBasedGap,
        isNeedsBased: true,
        guardrailActive: false,
        guardrailDirection: 'none',
        inflationFactor,
      };

    case 'FIXED_NOMINAL':
      return {
        year,
        targetWithdrawal: Math.max(0, config.annualWithdrawalTarget ?? 0),
        isNeedsBased: false,
        guardrailActive: false,
        guardrailDirection: 'none',
        inflationFactor,
      };

    case 'FIXED_REAL': {
      const realTarget = (config.annualWithdrawalTarget ?? 0) * inflationFactor;
      return {
        year,
        targetWithdrawal: Math.max(0, realTarget),
        isNeedsBased: false,
        guardrailActive: false,
        guardrailDirection: 'none',
        inflationFactor,
      };
    }

    case 'GUARDRAIL':
      return computeGuardrailInstruction(
        config.guardrailConfig!,
        year,
        state,
        beginningPortfolioValue,
        inflationFactor
      );

    default: {
      const exhaustiveCheck: never = config.strategyType;
      void exhaustiveCheck;
      return {
        year,
        targetWithdrawal: needsBasedGap,
        isNeedsBased: true,
        guardrailActive: false,
        guardrailDirection: 'none',
        inflationFactor,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Guardrail policy computation
// ---------------------------------------------------------------------------

/**
 * Simple, deterministic guardrail adjustment.
 *
 * Rules (applied in order):
 * 1. Compute portfolio-health ratio = currentPortfolio / initialPortfolio
 * 2. If ratio < lowerGuardrailPct → reduce prior target by decreaseStepPct
 * 3. If ratio > upperGuardrailPct → increase prior target by increaseStepPct
 * 4. Clamp to [floor, ceiling]
 *
 * This is a planning-grade approximation. It is NOT the Guyton-Klinger or
 * Bengen 4% rule; it is a simplified, transparent model for illustrative use.
 */
function computeGuardrailInstruction(
  guardrail: GuardrailConfig,
  year: number,
  state: PolicyEngineState,
  beginningPortfolioValue: number,
  inflationFactor: number
): WithdrawalYearInstruction {
  const priorTarget = state.currentYearTarget;
  const initialPortfolio = state.initialPortfolioValue;

  // Avoid divide-by-zero if initialPortfolio is somehow 0
  const portfolioRatio =
    initialPortfolio > 0 ? beginningPortfolioValue / initialPortfolio : 1;

  let newTarget = priorTarget;
  let direction: 'none' | 'reduced' | 'increased' = 'none';

  if (portfolioRatio < guardrail.lowerGuardrailPct) {
    newTarget = priorTarget * (1 - guardrail.decreaseStepPct);
    direction = 'reduced';
  } else if (portfolioRatio > guardrail.upperGuardrailPct) {
    newTarget = priorTarget * (1 + guardrail.increaseStepPct);
    direction = 'increased';
  }

  // Apply floor (expressed in today's dollars — inflate for real-dollar comparison)
  const inflatedFloor = guardrail.floorAnnualWithdrawal * inflationFactor;
  // Apply ceiling (multiple of initial annual withdrawal, inflated)
  const inflatedCeiling =
    guardrail.initialAnnualWithdrawal * guardrail.ceilingMultiplier * inflationFactor;

  newTarget = Math.max(inflatedFloor, Math.min(inflatedCeiling, newTarget));

  return {
    year,
    targetWithdrawal: Math.max(0, newTarget),
    isNeedsBased: false,
    guardrailActive: direction !== 'none',
    guardrailDirection: direction,
    inflationFactor,
  };
}

// ---------------------------------------------------------------------------
// Strategy-type metadata helpers (for UI display)
// ---------------------------------------------------------------------------

export function strategyTypeLabel(type: WithdrawalStrategyType): string {
  switch (type) {
    case 'NEEDS_BASED': return 'Needs-Based';
    case 'FIXED_NOMINAL': return 'Fixed Nominal';
    case 'FIXED_REAL': return 'Fixed Real (Inflation-Adjusted)';
    case 'INFLATION_ADJUSTED_SPENDING': return 'Inflation-Adjusted Spending';
    case 'GUARDRAIL': return 'Simple Guardrail';
  }
}
