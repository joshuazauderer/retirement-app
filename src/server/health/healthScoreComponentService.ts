/**
 * Phase 18 — Health Score Component Scorers
 *
 * Each scorer is a pure function that takes a ComponentInput and returns
 * an earned-points number plus human-readable explanation.
 * No DB calls. No financial re-computation.
 */

import {
  ComponentInput,
  HealthScoreComponent,
  HealthScoreComponentKey,
  COMPONENT_MAX_POINTS,
  COMPONENT_LABELS,
  COMPONENT_DESCRIPTIONS,
  tierFromPercentage,
} from './types';

// ─── Internal builder ────────────────────────────────────────────────────────

function buildComponent(
  key: HealthScoreComponentKey,
  earnedPoints: number,
  explanation: string,
  actionLabel: string | null,
  actionUrl: string | null,
): HealthScoreComponent {
  const maxPoints = COMPONENT_MAX_POINTS[key];
  const clamped   = Math.max(0, Math.min(earnedPoints, maxPoints));
  const pct       = maxPoints > 0 ? Math.round((clamped / maxPoints) * 100) : 0;
  return {
    key,
    label:       COMPONENT_LABELS[key],
    description: COMPONENT_DESCRIPTIONS[key],
    maxPoints,
    earnedPoints: clamped,
    percentage:   pct,
    tier:         tierFromPercentage(pct),
    explanation,
    actionLabel:  clamped >= maxPoints ? null : actionLabel,
    actionUrl:    clamped >= maxPoints ? null : actionUrl,
  };
}

// ─── 1. Portfolio Sufficiency (30 pts) ───────────────────────────────────────

/**
 * Full points (30) if latest simulation ends with positive balance.
 * Partial points (15) if balance is positive but portfolio was depleted mid-run.
 * Minimum points (5) if there is a simulation but balance went negative.
 * Zero if no simulation has ever been run.
 */
export function scorePortfolioSufficiency(input: ComponentInput): HealthScoreComponent {
  const key = 'portfolio_sufficiency' as const;

  if (!input.latestSimulation) {
    return buildComponent(
      key, 0,
      'No simulation has been run yet. Run a projection to see how your portfolio holds up.',
      'Run Simulation', '/app/simulations',
    );
  }

  const { endingBalance, firstDepletionYear, success } = input.latestSimulation;

  if (success && endingBalance > 0 && !firstDepletionYear) {
    return buildComponent(
      key, 30,
      `Your portfolio is projected to end retirement with a positive balance of ${fmt(endingBalance)}.`,
      null, null,
    );
  }

  if (firstDepletionYear) {
    return buildComponent(
      key, 5,
      `Your portfolio is projected to be depleted around ${firstDepletionYear}. Review withdrawal strategies and savings rate.`,
      'Review Withdrawal Strategies', '/app/withdrawal-strategies',
    );
  }

  // Has a simulation, ending balance ≤ 0 but no recorded depletion year
  if (endingBalance <= 0) {
    return buildComponent(
      key, 5,
      `Your portfolio projection ends with a zero or negative balance. Consider adjusting spending or increasing savings.`,
      'Review Scenarios', '/app/scenarios',
    );
  }

  // Positive balance but not flagged fully successful (partial scenario)
  return buildComponent(
    key, 15,
    `Your portfolio shows a positive ending balance of ${fmt(endingBalance)}, but your plan may need refinement.`,
    'Review Simulation', '/app/simulations',
  );
}

// ─── 2. Income Replacement (20 pts) ─────────────────────────────────────────

/**
 * Measures guaranteed income (benefits: SS, pension, etc.) as % of annual retirement expenses.
 * ≥80% → 20 pts  |  ≥60% → 15 pts  |  ≥40% → 10 pts  |  ≥20% → 5 pts  |  <20% → 0 pts
 */
export function scoreIncomeReplacement(input: ComponentInput): HealthScoreComponent {
  const key = 'income_replacement' as const;

  if (input.annualRetirementExpenses <= 0) {
    return buildComponent(
      key, 0,
      'No retirement expense data found. Set your expected retirement spending to compute this score.',
      'Set Expenses', '/app/expenses',
    );
  }

  const replacementRatio = input.annualGuaranteedIncome / input.annualRetirementExpenses;
  const replacementPct   = Math.round(replacementRatio * 100);

  if (replacementRatio >= 0.80) {
    return buildComponent(
      key, 20,
      `Guaranteed income covers ${replacementPct}% of projected retirement expenses — an excellent foundation.`,
      null, null,
    );
  }
  if (replacementRatio >= 0.60) {
    return buildComponent(
      key, 15,
      `Guaranteed income covers ${replacementPct}% of retirement expenses. Consider optimizing Social Security claiming.`,
      'Optimize Social Security', '/app/social-security',
    );
  }
  if (replacementRatio >= 0.40) {
    return buildComponent(
      key, 10,
      `Guaranteed income covers ${replacementPct}% of retirement expenses. Building more guaranteed income would reduce portfolio risk.`,
      'Review Benefits', '/app/benefits',
    );
  }
  if (replacementRatio >= 0.20) {
    return buildComponent(
      key, 5,
      `Guaranteed income covers only ${replacementPct}% of retirement expenses. Your portfolio will need to carry most of the load.`,
      'Review Benefits', '/app/benefits',
    );
  }

  return buildComponent(
    key, 0,
    `Guaranteed income covers only ${replacementPct}% of retirement expenses. Consider adding benefit sources or delaying Social Security.`,
    'Add Benefits', '/app/benefits',
  );
}

// ─── 3. Debt Load (10 pts) ───────────────────────────────────────────────────

/**
 * Total liabilities (incl. mortgage) as % of total assets (financial + real estate).
 * ≤10% → 10 pts  |  ≤25% → 8 pts  |  ≤40% → 5 pts  |  ≤60% → 2 pts  |  >60% → 0 pts
 */
export function scoreDebtLoad(input: ComponentInput): HealthScoreComponent {
  const key = 'debt_load' as const;

  const totalAssets      = input.totalAssets + input.totalRealEstateValue;
  const totalDebt        = input.totalLiabilities + input.totalRealEstateMortgageDebt;

  if (totalAssets <= 0) {
    return buildComponent(
      key, 0,
      'No asset data found. Add your financial accounts to compute debt load.',
      'Add Assets', '/app/assets',
    );
  }

  const debtRatio    = totalDebt / totalAssets;
  const debtRatioPct = Math.round(debtRatio * 100);

  if (debtRatio <= 0.10) {
    return buildComponent(
      key, 10,
      `Debt is ${debtRatioPct}% of total assets — an excellent debt position heading into retirement.`,
      null, null,
    );
  }
  if (debtRatio <= 0.25) {
    return buildComponent(
      key, 8,
      `Debt is ${debtRatioPct}% of total assets — a healthy debt-to-asset ratio.`,
      null, null,
    );
  }
  if (debtRatio <= 0.40) {
    return buildComponent(
      key, 5,
      `Debt is ${debtRatioPct}% of total assets. A moderate debt level; consider accelerating paydown before retirement.`,
      'Review Liabilities', '/app/liabilities',
    );
  }
  if (debtRatio <= 0.60) {
    return buildComponent(
      key, 2,
      `Debt is ${debtRatioPct}% of total assets. High leverage before retirement increases sequence-of-returns risk.`,
      'Review Liabilities', '/app/liabilities',
    );
  }

  return buildComponent(
    key, 0,
    `Debt is ${debtRatioPct}% of total assets — a very high ratio that could significantly impact retirement security.`,
    'Review Liabilities', '/app/liabilities',
  );
}

// ─── 4. Healthcare Preparedness (15 pts) ─────────────────────────────────────

/**
 * Has a healthcare planning run been completed?
 * Yes → 15 pts  |  No → 0 pts
 *
 * Phase 18 keeps this binary because healthcare planning is a discrete action.
 */
export function scoreHealthcarePreparedness(input: ComponentInput): HealthScoreComponent {
  const key = 'healthcare_preparedness' as const;

  if (input.hasHealthcarePlan) {
    return buildComponent(
      key, 15,
      'Healthcare costs have been modeled as part of your retirement plan.',
      null, null,
    );
  }

  return buildComponent(
    key, 0,
    'No healthcare plan has been modeled. Healthcare is often the largest unplanned retirement expense.',
    'Plan Healthcare Costs', '/app/healthcare-planning',
  );
}

// ─── 5. Longevity Coverage (10 pts) ──────────────────────────────────────────

/**
 * Does the simulation project through the primary member's life expectancy (or at least age 90)?
 * Fully through expectancy → 10 pts
 * Through at least age 90 → 7 pts
 * Through at least age 85 → 4 pts
 * Shorter / no simulation → 0 pts
 */
export function scoreLongevityCoverage(input: ComponentInput): HealthScoreComponent {
  const key = 'longevity_coverage' as const;

  if (!input.latestSimulation || !input.primaryMemberCurrentAge) {
    return buildComponent(
      key, 0,
      'No simulation data to evaluate longevity coverage. Run a projection first.',
      'Run Simulation', '/app/simulations',
    );
  }

  const { projectionEndYear, projectionStartYear } = input.latestSimulation;
  const currentAge      = input.primaryMemberCurrentAge;
  const yearsProjected  = projectionEndYear - projectionStartYear;
  const projectedEndAge = currentAge + yearsProjected;

  const lifeExpectancy  = input.primaryMemberLifeExpectancy ?? 90;
  const targetAge       = Math.max(lifeExpectancy, 90);

  if (projectedEndAge >= targetAge) {
    return buildComponent(
      key, 10,
      `Your plan projects through age ${projectedEndAge}, covering your life expectancy of ${lifeExpectancy}.`,
      null, null,
    );
  }
  if (projectedEndAge >= 90) {
    return buildComponent(
      key, 7,
      `Your plan projects through age ${projectedEndAge}. Consider extending to your full life expectancy of ${lifeExpectancy}.`,
      'Run Longevity Stress Test', '/app/longevity-stress',
    );
  }
  if (projectedEndAge >= 85) {
    return buildComponent(
      key, 4,
      `Your plan only projects through age ${projectedEndAge}. Extend the projection to capture full longevity risk.`,
      'Run Longevity Stress Test', '/app/longevity-stress',
    );
  }

  return buildComponent(
    key, 0,
    `Your plan projects through age ${projectedEndAge} — too short to capture retirement longevity risk.`,
    'Run Longevity Stress Test', '/app/longevity-stress',
  );
}

// ─── 6. Emergency Buffer (10 pts) ────────────────────────────────────────────

/**
 * Liquid assets (CHECKING, SAVINGS, CASH, CD, BROKERAGE) as months of annual retirement expenses.
 * ≥12 months → 10 pts  |  ≥6 months → 7 pts  |  ≥3 months → 4 pts  |  <3 months → 1 pt  |  no data → 0
 */
export function scoreEmergencyBuffer(input: ComponentInput): HealthScoreComponent {
  const key = 'emergency_buffer' as const;

  if (input.annualRetirementExpenses <= 0) {
    return buildComponent(
      key, 0,
      'No expense data found. Enter your expected retirement spending to evaluate your emergency buffer.',
      'Set Expenses', '/app/expenses',
    );
  }

  if (input.totalLiquidAssets <= 0) {
    return buildComponent(
      key, 0,
      'No liquid assets found. Ensure checking, savings, and brokerage accounts are entered.',
      'Add Assets', '/app/assets',
    );
  }

  const monthlyExpenses  = input.annualRetirementExpenses / 12;
  const monthsCovered    = input.totalLiquidAssets / monthlyExpenses;
  const monthsRounded    = Math.round(monthsCovered * 10) / 10;

  if (monthsCovered >= 12) {
    return buildComponent(
      key, 10,
      `Liquid assets cover ${monthsRounded} months of retirement expenses — excellent emergency buffer.`,
      null, null,
    );
  }
  if (monthsCovered >= 6) {
    return buildComponent(
      key, 7,
      `Liquid assets cover ${monthsRounded} months of expenses. A solid buffer; 12+ months is ideal entering retirement.`,
      null, null,
    );
  }
  if (monthsCovered >= 3) {
    return buildComponent(
      key, 4,
      `Liquid assets cover ${monthsRounded} months of expenses. Consider building to at least 6 months before retiring.`,
      'Review Assets', '/app/assets',
    );
  }

  return buildComponent(
    key, 1,
    `Liquid assets cover only ${monthsRounded} months of expenses — below the recommended minimum of 3 months.`,
    'Review Assets', '/app/assets',
  );
}

// ─── 7. Profile Completeness (5 pts) ─────────────────────────────────────────

/**
 * Based on profileCompletionService output (0–100%).
 * ≥90% → 5 pts  |  ≥70% → 3 pts  |  ≥50% → 2 pts  |  <50% → 0 pts
 */
export function scoreProfileCompleteness(input: ComponentInput): HealthScoreComponent {
  const key = 'profile_completeness' as const;
  const pct = input.profileCompletionPct;

  if (pct >= 90) {
    return buildComponent(
      key, 5,
      `Your profile is ${pct}% complete — all key data has been entered.`,
      null, null,
    );
  }
  if (pct >= 70) {
    return buildComponent(
      key, 3,
      `Your profile is ${pct}% complete. Finishing the remaining sections will improve your score accuracy.`,
      'Complete Profile', '/app/overview',
    );
  }
  if (pct >= 50) {
    return buildComponent(
      key, 2,
      `Your profile is ${pct}% complete. Several key data categories are missing.`,
      'Complete Profile', '/app/overview',
    );
  }

  return buildComponent(
    key, 0,
    `Your profile is only ${pct}% complete. Many scores are limited by missing data.`,
    'Complete Profile', '/app/overview',
  );
}

// ─── All Components ──────────────────────────────────────────────────────────

export function computeAllComponents(input: ComponentInput): HealthScoreComponent[] {
  return [
    scorePortfolioSufficiency(input),
    scoreIncomeReplacement(input),
    scoreDebtLoad(input),
    scoreHealthcarePreparedness(input),
    scoreLongevityCoverage(input),
    scoreEmergencyBuffer(input),
    scoreProfileCompleteness(input),
  ];
}

// ─── Formatter ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}
