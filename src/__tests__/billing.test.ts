import { describe, test, expect } from 'vitest';
import { getPlanDefinitions, getPlanByType, planTypeFromStripePriceId, mapStripeStatus } from '../server/billing/pricingService';
import { checkFeatureGateForPlan } from '../server/billing/featureGateService';
import { PLAN_FEATURES, PLAN_LIMITS } from '../server/billing/types';

// ──────────────────────────────────────────────
// pricingService
// ──────────────────────────────────────────────

describe('pricingService', () => {
  test('getPlanDefinitions returns 3 plans', () => {
    const plans = getPlanDefinitions();
    expect(plans).toHaveLength(3);
  });

  test('getPlanDefinitions returns plans in order FREE, PRO, ADVISOR', () => {
    const plans = getPlanDefinitions();
    expect(plans[0].planType).toBe('FREE');
    expect(plans[1].planType).toBe('PRO');
    expect(plans[2].planType).toBe('ADVISOR');
  });

  test('PRO plan has highlighted=true', () => {
    const plans = getPlanDefinitions();
    const pro = plans.find((p) => p.planType === 'PRO');
    expect(pro?.highlighted).toBe(true);
  });

  test('FREE plan has monthlyPriceCents=0', () => {
    const plans = getPlanDefinitions();
    const free = plans.find((p) => p.planType === 'FREE');
    expect(free?.monthlyPriceCents).toBe(0);
  });

  test('getPlanByType PRO returns PRO plan', () => {
    const plan = getPlanByType('PRO');
    expect(plan.planType).toBe('PRO');
  });

  test('getPlanByType FREE returns FREE plan', () => {
    const plan = getPlanByType('FREE');
    expect(plan.planType).toBe('FREE');
  });

  test('planTypeFromStripePriceId returns FREE for unknown price ID', () => {
    const result = planTypeFromStripePriceId('price_unknown_xyz');
    expect(result).toBe('FREE');
  });

  test('mapStripeStatus active → ACTIVE', () => {
    expect(mapStripeStatus('active')).toBe('ACTIVE');
  });

  test('mapStripeStatus canceled → CANCELED', () => {
    expect(mapStripeStatus('canceled')).toBe('CANCELED');
  });

  test('mapStripeStatus past_due → PAST_DUE', () => {
    expect(mapStripeStatus('past_due')).toBe('PAST_DUE');
  });

  test('mapStripeStatus trialing → TRIALING', () => {
    expect(mapStripeStatus('trialing')).toBe('TRIALING');
  });

  test('mapStripeStatus unknown status → CANCELED', () => {
    expect(mapStripeStatus('something_unexpected')).toBe('CANCELED');
  });

  test('mapStripeStatus incomplete_expired → CANCELED', () => {
    expect(mapStripeStatus('incomplete_expired')).toBe('CANCELED');
  });
});

// ──────────────────────────────────────────────
// featureGateService (pure, no DB)
// ──────────────────────────────────────────────

describe('featureGateService', () => {
  test('FREE plan cannot use monte_carlo', () => {
    const result = checkFeatureGateForPlan('FREE', 'monte_carlo');
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
  });

  test('PRO plan can use monte_carlo', () => {
    const result = checkFeatureGateForPlan('PRO', 'monte_carlo');
    expect(result.allowed).toBe(true);
    expect(result.upgradeRequired).toBe(false);
  });

  test('FREE plan can use tax_planning (free feature)', () => {
    const result = checkFeatureGateForPlan('FREE', 'tax_planning');
    expect(result.allowed).toBe(true);
  });

  test('PRO plan can use ai_insights', () => {
    const result = checkFeatureGateForPlan('PRO', 'ai_insights');
    expect(result.allowed).toBe(true);
  });

  test('FREE plan cannot use collaboration, requiredPlan is PRO', () => {
    const result = checkFeatureGateForPlan('FREE', 'collaboration');
    expect(result.allowed).toBe(false);
    expect(result.requiredPlan).toBe('PRO');
  });

  test('ADVISOR plan can use advisor_access', () => {
    const result = checkFeatureGateForPlan('ADVISOR', 'advisor_access');
    expect(result.allowed).toBe(true);
  });

  test('PRO plan cannot use advisor_access', () => {
    const result = checkFeatureGateForPlan('PRO', 'advisor_access');
    expect(result.allowed).toBe(false);
  });

  test('FREE monte_carlo gate includes reason string mentioning PRO plan', () => {
    const result = checkFeatureGateForPlan('FREE', 'monte_carlo');
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('PRO');
  });

  test('requiredPlan for advisor_access is ADVISOR', () => {
    const result = checkFeatureGateForPlan('FREE', 'advisor_access');
    expect(result.requiredPlan).toBe('ADVISOR');
  });
});

// ──────────────────────────────────────────────
// types / PLAN_FEATURES
// ──────────────────────────────────────────────

describe('PLAN_FEATURES', () => {
  test('PLAN_FEATURES.FREE has tax_planning', () => {
    expect(PLAN_FEATURES.FREE.has('tax_planning')).toBe(true);
  });

  test('PLAN_FEATURES.FREE has advanced_scenarios', () => {
    expect(PLAN_FEATURES.FREE.has('advanced_scenarios')).toBe(true);
  });

  test('PLAN_FEATURES.PRO has all FREE features plus more', () => {
    for (const feature of PLAN_FEATURES.FREE) {
      expect(PLAN_FEATURES.PRO.has(feature)).toBe(true);
    }
    expect(PLAN_FEATURES.PRO.size).toBeGreaterThan(PLAN_FEATURES.FREE.size);
  });

  test('PLAN_FEATURES.ADVISOR has everything PRO has plus advisor_access', () => {
    for (const feature of PLAN_FEATURES.PRO) {
      expect(PLAN_FEATURES.ADVISOR.has(feature)).toBe(true);
    }
    expect(PLAN_FEATURES.ADVISOR.has('advisor_access')).toBe(true);
  });
});

describe('PLAN_LIMITS', () => {
  test('PLAN_LIMITS.FREE.scenarios === 3', () => {
    expect(PLAN_LIMITS.FREE.scenarios).toBe(3);
  });

  test('PLAN_LIMITS.FREE.collaborators === 0', () => {
    expect(PLAN_LIMITS.FREE.collaborators).toBe(0);
  });

  test('PLAN_LIMITS.PRO.scenarios === null (unlimited)', () => {
    expect(PLAN_LIMITS.PRO.scenarios).toBeNull();
  });

  test('PLAN_LIMITS.ADVISOR.collaborators === 10', () => {
    expect(PLAN_LIMITS.ADVISOR.collaborators).toBe(10);
  });
});

// ──────────────────────────────────────────────
// Golden cases
// ──────────────────────────────────────────────

describe('golden cases', () => {
  test('FREE user cannot use monte_carlo, ai_insights, ai_copilot, or collaboration', () => {
    const gatedFeatures = ['monte_carlo', 'ai_insights', 'ai_copilot', 'collaboration'] as const;
    for (const feature of gatedFeatures) {
      const result = checkFeatureGateForPlan('FREE', feature);
      expect(result.allowed).toBe(false);
    }
  });

  test('PRO user can use monte_carlo, ai_insights, ai_copilot, healthcare_planning', () => {
    const proFeatures = ['monte_carlo', 'ai_insights', 'ai_copilot', 'healthcare_planning'] as const;
    for (const feature of proFeatures) {
      const result = checkFeatureGateForPlan('PRO', feature);
      expect(result.allowed).toBe(true);
    }
  });

  test('ADVISOR user can use advisor_access but PRO user cannot', () => {
    expect(checkFeatureGateForPlan('ADVISOR', 'advisor_access').allowed).toBe(true);
    expect(checkFeatureGateForPlan('PRO', 'advisor_access').allowed).toBe(false);
  });

  test('requiredPlan for collaboration is PRO', () => {
    const result = checkFeatureGateForPlan('FREE', 'collaboration');
    expect(result.requiredPlan).toBe('PRO');
  });

  test('requiredPlan for advisor_access is ADVISOR', () => {
    const result = checkFeatureGateForPlan('FREE', 'advisor_access');
    expect(result.requiredPlan).toBe('ADVISOR');
  });

  test('all FeatureName values are included in at least one plan', () => {
    const allFeatures = [
      'monte_carlo',
      'ai_insights',
      'ai_copilot',
      'advanced_scenarios',
      'tax_planning',
      'healthcare_planning',
      'housing_planning',
      'reports_export',
      'csv_export',
      'collaboration',
      'advisor_access',
      'unlimited_simulations',
      'unlimited_scenarios',
    ] as const;

    for (const feature of allFeatures) {
      const inSomePlan =
        PLAN_FEATURES.FREE.has(feature) ||
        PLAN_FEATURES.PRO.has(feature) ||
        PLAN_FEATURES.ADVISOR.has(feature);
      expect(inSomePlan).toBe(true);
    }
  });
});
