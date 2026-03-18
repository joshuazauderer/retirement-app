import type { ScenarioOverridePayload, OverrideValidationResult } from './types';

export function validateOverrides(overrides: ScenarioOverridePayload): OverrideValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (overrides.inflationRateOverride !== undefined) {
    if (overrides.inflationRateOverride < 0 || overrides.inflationRateOverride > 0.20) {
      errors.push(`Inflation rate override (${(overrides.inflationRateOverride * 100).toFixed(1)}%) is outside reasonable bounds (0–20%).`);
    }
  }

  if (overrides.expectedReturnOverride !== undefined) {
    if (overrides.expectedReturnOverride < 0 || overrides.expectedReturnOverride > 0.30) {
      errors.push(`Expected return override (${(overrides.expectedReturnOverride * 100).toFixed(1)}%) is outside reasonable bounds (0–30%).`);
    }
    if (overrides.expectedReturnOverride > 0.15) {
      warnings.push(`Expected return of ${(overrides.expectedReturnOverride * 100).toFixed(1)}% is aggressive. Consider using a more conservative estimate.`);
    }
  }

  if (overrides.taxRateOverride !== undefined) {
    if (overrides.taxRateOverride < 0 || overrides.taxRateOverride > 0.60) {
      errors.push(`Tax rate override (${(overrides.taxRateOverride * 100).toFixed(1)}%) is outside reasonable bounds.`);
    }
  }

  if (overrides.retirementEssentialOverride !== undefined && overrides.retirementEssentialOverride < 0) {
    errors.push('Retirement essential spending cannot be negative.');
  }
  if (overrides.retirementDiscretionaryOverride !== undefined && overrides.retirementDiscretionaryOverride < 0) {
    errors.push('Retirement discretionary spending cannot be negative.');
  }
  if (overrides.retirementDiscretionaryPctChange !== undefined) {
    if (overrides.retirementDiscretionaryPctChange < -1 || overrides.retirementDiscretionaryPctChange > 2) {
      errors.push('Discretionary spending % change must be between -100% and +200%.');
    }
  }
  if (overrides.additionalAnnualSavings !== undefined && overrides.additionalAnnualSavings < 0) {
    errors.push('Additional annual savings cannot be negative.');
  }
  if (overrides.healthcareAnnualOverride !== undefined && overrides.healthcareAnnualOverride < 0) {
    errors.push('Healthcare annual estimate cannot be negative.');
  }

  if (overrides.memberOverrides) {
    for (const mo of overrides.memberOverrides) {
      if (mo.retirementAgeOverride !== undefined) {
        if (mo.retirementAgeOverride < 40 || mo.retirementAgeOverride > 80) {
          errors.push(`Retirement age override of ${mo.retirementAgeOverride} is outside reasonable bounds (40–80).`);
        }
      }
      if (mo.lifeExpectancyOverride !== undefined) {
        if (mo.lifeExpectancyOverride < 60 || mo.lifeExpectancyOverride > 110) {
          errors.push(`Life expectancy override of ${mo.lifeExpectancyOverride} is outside reasonable bounds.`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
