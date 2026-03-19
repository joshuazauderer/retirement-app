/**
 * Phase 18 — Retirement Health Score + Plan Status Engine
 *
 * Synthesizes all planning data into a single actionable score.
 * Computed on demand from stored engine outputs — never re-computes financial math.
 *
 * Limitations:
 * - Score is a planning-guidance heuristic, not a financial guarantee
 * - Components are weighted by their estimated importance to retirement readiness
 * - Score reflects current data completeness; incomplete profiles score lower
 */

// ─── Score Tiers ────────────────────────────────────────────────────────────

export type HealthScoreTier =
  | 'EXCELLENT'
  | 'GOOD'
  | 'FAIR'
  | 'AT_RISK'
  | 'CRITICAL';

export const TIER_THRESHOLDS: Record<HealthScoreTier, number> = {
  EXCELLENT: 90,
  GOOD:      75,
  FAIR:      60,
  AT_RISK:   40,
  CRITICAL:  0,
};

export const TIER_LABELS: Record<HealthScoreTier, string> = {
  EXCELLENT: 'Excellent',
  GOOD:      'Good',
  FAIR:      'Fair',
  AT_RISK:   'At Risk',
  CRITICAL:  'Critical',
};

export const TIER_COLORS: Record<HealthScoreTier, string> = {
  EXCELLENT: 'green',
  GOOD:      'teal',
  FAIR:      'yellow',
  AT_RISK:   'orange',
  CRITICAL:  'red',
};

export const TIER_BG_CLASSES: Record<HealthScoreTier, string> = {
  EXCELLENT: 'bg-green-50 border-green-200',
  GOOD:      'bg-teal-50 border-teal-200',
  FAIR:      'bg-yellow-50 border-yellow-200',
  AT_RISK:   'bg-orange-50 border-orange-200',
  CRITICAL:  'bg-red-50 border-red-200',
};

export const TIER_TEXT_CLASSES: Record<HealthScoreTier, string> = {
  EXCELLENT: 'text-green-700',
  GOOD:      'text-teal-700',
  FAIR:      'text-yellow-700',
  AT_RISK:   'text-orange-700',
  CRITICAL:  'text-red-700',
};

export const TIER_BADGE_CLASSES: Record<HealthScoreTier, string> = {
  EXCELLENT: 'bg-green-100 text-green-800',
  GOOD:      'bg-teal-100 text-teal-800',
  FAIR:      'bg-yellow-100 text-yellow-800',
  AT_RISK:   'bg-orange-100 text-orange-800',
  CRITICAL:  'bg-red-100 text-red-800',
};

// ─── Component Keys ──────────────────────────────────────────────────────────

export type HealthScoreComponentKey =
  | 'portfolio_sufficiency'
  | 'income_replacement'
  | 'debt_load'
  | 'healthcare_preparedness'
  | 'longevity_coverage'
  | 'emergency_buffer'
  | 'profile_completeness';

export const COMPONENT_MAX_POINTS: Record<HealthScoreComponentKey, number> = {
  portfolio_sufficiency:   30,
  income_replacement:      20,
  debt_load:               10,
  healthcare_preparedness: 15,
  longevity_coverage:      10,
  emergency_buffer:        10,
  profile_completeness:     5,
};

export const COMPONENT_LABELS: Record<HealthScoreComponentKey, string> = {
  portfolio_sufficiency:   'Portfolio Sufficiency',
  income_replacement:      'Income Replacement',
  debt_load:               'Debt Load',
  healthcare_preparedness: 'Healthcare Preparedness',
  longevity_coverage:      'Longevity Coverage',
  emergency_buffer:        'Emergency Buffer',
  profile_completeness:    'Profile Completeness',
};

export const COMPONENT_DESCRIPTIONS: Record<HealthScoreComponentKey, string> = {
  portfolio_sufficiency:
    'Measures whether your portfolio is projected to remain positive through retirement based on your latest simulation.',
  income_replacement:
    'Measures how much of your retirement expenses are covered by guaranteed income sources (Social Security, pensions, benefits).',
  debt_load:
    'Evaluates your total liabilities relative to total assets. Lower debt-to-asset ratio earns more points.',
  healthcare_preparedness:
    'Checks whether you have modeled healthcare costs and have a healthcare plan in place.',
  longevity_coverage:
    'Assesses whether your plan covers you through age 90 or beyond based on your simulation end year.',
  emergency_buffer:
    'Measures liquid asset coverage of your annual living expenses (target: 6+ months).',
  profile_completeness:
    'Rewards having a complete financial profile with all key data entered.',
};

// ─── Score Component ─────────────────────────────────────────────────────────

export interface HealthScoreComponent {
  key:          HealthScoreComponentKey;
  label:        string;
  description:  string;
  maxPoints:    number;
  earnedPoints: number;
  percentage:   number;          // 0–100: earnedPoints / maxPoints * 100
  tier:         HealthScoreTier; // tier for this component alone
  explanation:  string;          // Human-readable: what was found and why these points
  actionLabel:  string | null;   // CTA text (null if already maxed)
  actionUrl:    string | null;   // CTA link
}

// ─── Overall Score ───────────────────────────────────────────────────────────

export interface HealthScoreResult {
  householdId:     string;
  totalScore:      number;       // 0–100
  maxScore:        number;       // Always 100
  tier:            HealthScoreTier;
  tierLabel:       string;
  components:      HealthScoreComponent[];
  summary:         string;       // 1-2 sentence overall narrative
  topActions:      string[];     // Up to 3 highest-impact action items
  lastComputedAt:  string;       // ISO timestamp
  dataAsOf: {
    hasSimulation:         boolean;
    hasHealthcarePlan:     boolean;
    hasHousingPlan:        boolean;
    latestSimulationDate:  string | null;
  };
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

export interface ComponentInput {
  totalAssets:                 number;
  totalLiabilities:            number;
  totalRealEstateValue:        number;
  totalRealEstateMortgageDebt: number;
  totalLiquidAssets:           number;
  annualRetirementExpenses:    number;
  annualGuaranteedIncome:      number;
  profileCompletionPct:        number;
  latestSimulation: {
    endingBalance:      number;
    projectionEndYear:  number;
    firstDepletionYear: number | null;
    projectionStartYear: number;
    success:            boolean;
  } | null;
  hasHealthcarePlan:           boolean;
  primaryMemberCurrentAge:     number | null;
  primaryMemberLifeExpectancy: number | null;
  simulationYearStart:         number;
}

/** Derive health score tier from a 0–100 percentage */
export function tierFromPercentage(pct: number): HealthScoreTier {
  if (pct >= TIER_THRESHOLDS.EXCELLENT) return 'EXCELLENT';
  if (pct >= TIER_THRESHOLDS.GOOD)      return 'GOOD';
  if (pct >= TIER_THRESHOLDS.FAIR)      return 'FAIR';
  if (pct >= TIER_THRESHOLDS.AT_RISK)   return 'AT_RISK';
  return 'CRITICAL';
}
