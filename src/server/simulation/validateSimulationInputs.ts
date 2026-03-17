import type { SimulationSnapshot } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSimulationInputs(
  snapshot: SimulationSnapshot
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!snapshot.members || snapshot.members.length === 0) {
    errors.push("No household members found. Please complete onboarding.");
  }

  for (const m of snapshot.members) {
    if (m.retirementTargetAge < m.currentAge) {
      errors.push(
        `${m.firstName}'s retirement age (${m.retirementTargetAge}) is less than current age (${m.currentAge}).`
      );
    }
    if (m.lifeExpectancy < m.retirementTargetAge) {
      errors.push(
        `${m.firstName}'s life expectancy (${m.lifeExpectancy}) is less than retirement age.`
      );
    }
    if (m.lifeExpectancy > 120) {
      errors.push(
        `${m.firstName}'s life expectancy (${m.lifeExpectancy}) seems unrealistic.`
      );
    }
  }

  const ep = snapshot.expenseProfile;
  if (!ep || ep.currentAnnualSpending < 0) {
    errors.push(
      "Expense profile is missing or invalid. Please add expense data."
    );
  }

  const pa = snapshot.planningAssumptions;
  if (pa.assumedEffectiveTaxRate < 0 || pa.assumedEffectiveTaxRate > 0.9) {
    errors.push(
      `Tax rate assumption (${(pa.assumedEffectiveTaxRate * 100).toFixed(1)}%) is out of reasonable bounds.`
    );
  }
  if (pa.inflationRate < 0 || pa.inflationRate > 0.2) {
    errors.push(
      `Inflation rate assumption (${(pa.inflationRate * 100).toFixed(1)}%) is out of reasonable bounds.`
    );
  }
  if (pa.expectedPortfolioReturn < 0 || pa.expectedPortfolioReturn > 0.3) {
    warnings.push(
      `Expected portfolio return (${(pa.expectedPortfolioReturn * 100).toFixed(1)}%) is unusual. Please verify.`
    );
  }

  if (snapshot.assetAccounts.length === 0) {
    warnings.push(
      "No asset accounts found. The projection will assume zero starting assets."
    );
  }

  if (
    snapshot.expenseProfile.currentAnnualSpending === 0 &&
    snapshot.expenseProfile.retirementEssential === 0
  ) {
    warnings.push(
      "Expense profile appears incomplete. Consider adding detailed expense data for more accurate results."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
