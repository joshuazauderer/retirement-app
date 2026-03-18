import type { SimulationSnapshot } from '@/server/simulation/types';
import type { ScenarioOverridePayload } from './types';

export function mergeScenarioOverrides(
  baselineSnapshot: SimulationSnapshot,
  overrides: ScenarioOverridePayload | null | undefined,
  scenarioId: string,
  scenarioName: string
): SimulationSnapshot {
  if (!overrides) {
    // No overrides — return baseline snapshot with scenario metadata
    return {
      ...baselineSnapshot,
      metadata: {
        ...baselineSnapshot.metadata,
        scenarioLabel: scenarioName,
      },
    };
  }

  // Deep clone baseline
  const merged: SimulationSnapshot = JSON.parse(JSON.stringify(baselineSnapshot));
  merged.metadata.scenarioLabel = scenarioName;

  // Apply member timing overrides
  if (overrides.memberOverrides) {
    for (const mo of overrides.memberOverrides) {
      const member = merged.members.find(m => m.memberId === mo.memberId);
      if (member) {
        if (mo.retirementAgeOverride !== undefined) {
          member.retirementTargetAge = mo.retirementAgeOverride;
        }
        if (mo.lifeExpectancyOverride !== undefined) {
          member.lifeExpectancy = mo.lifeExpectancyOverride;
          merged.planningAssumptions.longevityTargets[mo.memberId] = mo.lifeExpectancyOverride;
        }
      }
    }
    // Recalculate projection end year based on updated longevity
    const memberEndYears = merged.members.map(m => {
      const birthYear = parseInt(m.dateOfBirth.slice(0, 4), 10);
      return birthYear + m.lifeExpectancy;
    });
    merged.timeline.projectionEndYear = Math.max(...memberEndYears, merged.timeline.simulationYearStart + 20);
  }

  // Apply planning assumption overrides
  if (overrides.inflationRateOverride !== undefined) {
    merged.planningAssumptions.inflationRate = overrides.inflationRateOverride;
    merged.expenseProfile.inflationRate = overrides.inflationRateOverride;
  }
  if (overrides.expectedReturnOverride !== undefined) {
    merged.planningAssumptions.expectedPortfolioReturn = overrides.expectedReturnOverride;
    // Also update accounts that use the global return (heuristic: round numbers match)
    for (const acc of merged.assetAccounts) {
      acc.expectedReturnRate = overrides.expectedReturnOverride;
    }
  }
  if (overrides.taxRateOverride !== undefined) {
    merged.planningAssumptions.assumedEffectiveTaxRate = overrides.taxRateOverride;
  }

  // Apply expense overrides
  if (overrides.retirementEssentialOverride !== undefined) {
    merged.expenseProfile.retirementEssential = overrides.retirementEssentialOverride;
  }
  if (overrides.retirementDiscretionaryOverride !== undefined) {
    merged.expenseProfile.retirementDiscretionary = overrides.retirementDiscretionaryOverride;
  } else if (overrides.retirementDiscretionaryPctChange !== undefined) {
    merged.expenseProfile.retirementDiscretionary =
      merged.expenseProfile.retirementDiscretionary * (1 + overrides.retirementDiscretionaryPctChange);
  }
  if (overrides.healthcareAnnualOverride !== undefined) {
    merged.expenseProfile.healthcareAnnual = overrides.healthcareAnnualOverride;
  }
  if (overrides.housingAnnualOverride !== undefined) {
    merged.expenseProfile.housingAnnual = overrides.housingAnnualOverride;
  }

  // Apply savings / contribution overrides
  if (overrides.additionalAnnualSavings !== undefined && overrides.additionalAnnualSavings > 0) {
    // Add to first non-depleted account (prefer retirement accounts)
    const target = merged.assetAccounts.find(a => a.isRetirementAccount) ?? merged.assetAccounts[0];
    if (target) {
      target.annualContribution += overrides.additionalAnnualSavings;
    }
  }
  if (overrides.accountContributionOverrides) {
    for (const aco of overrides.accountContributionOverrides) {
      const acc = merged.assetAccounts.find(a => a.id === aco.accountId);
      if (acc) acc.annualContribution = aco.annualContributionOverride;
    }
  }

  // Apply benefit claim age overrides
  if (overrides.benefitClaimAgeOverrides) {
    for (const bco of overrides.benefitClaimAgeOverrides) {
      const benefit = merged.benefitSources.find(b => b.id === bco.benefitId);
      if (benefit) benefit.claimAge = bco.claimAgeOverride;
    }
  }

  return merged;
}

// Build human-readable diff of what changed between baseline and override
export function buildAssumptionDiffs(
  baseline: SimulationSnapshot,
  effective: SimulationSnapshot,
  overrides: ScenarioOverridePayload | null | undefined
): Array<{ label: string; baseline: string; scenario: string; changed: boolean }> {
  if (!overrides) return [];

  const diffs: Array<{ label: string; baseline: string; scenario: string; changed: boolean }> = [];
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

  // Member timing
  if (overrides.memberOverrides) {
    for (const mo of overrides.memberOverrides) {
      const bm = baseline.members.find(m => m.memberId === mo.memberId);
      const em = effective.members.find(m => m.memberId === mo.memberId);
      if (!bm || !em) continue;
      if (mo.retirementAgeOverride !== undefined) {
        diffs.push({ label: `${bm.firstName} Retirement Age`, baseline: bm.retirementTargetAge.toString(), scenario: mo.retirementAgeOverride.toString(), changed: true });
      }
      if (mo.lifeExpectancyOverride !== undefined) {
        diffs.push({ label: `${bm.firstName} Life Expectancy`, baseline: bm.lifeExpectancy.toString(), scenario: mo.lifeExpectancyOverride.toString(), changed: true });
      }
    }
  }

  // Planning assumptions
  if (overrides.inflationRateOverride !== undefined) {
    diffs.push({ label: 'Inflation Rate', baseline: pct(baseline.planningAssumptions.inflationRate), scenario: pct(overrides.inflationRateOverride), changed: true });
  }
  if (overrides.expectedReturnOverride !== undefined) {
    diffs.push({ label: 'Expected Return', baseline: pct(baseline.planningAssumptions.expectedPortfolioReturn), scenario: pct(overrides.expectedReturnOverride), changed: true });
  }
  if (overrides.taxRateOverride !== undefined) {
    diffs.push({ label: 'Effective Tax Rate', baseline: pct(baseline.planningAssumptions.assumedEffectiveTaxRate), scenario: pct(overrides.taxRateOverride), changed: true });
  }

  // Expenses
  if (overrides.retirementEssentialOverride !== undefined) {
    diffs.push({ label: 'Retirement Essential', baseline: usd(baseline.expenseProfile.retirementEssential), scenario: usd(overrides.retirementEssentialOverride), changed: true });
  }
  if (overrides.retirementDiscretionaryOverride !== undefined) {
    diffs.push({ label: 'Retirement Discretionary', baseline: usd(baseline.expenseProfile.retirementDiscretionary), scenario: usd(overrides.retirementDiscretionaryOverride), changed: true });
  } else if (overrides.retirementDiscretionaryPctChange !== undefined) {
    const newVal = baseline.expenseProfile.retirementDiscretionary * (1 + overrides.retirementDiscretionaryPctChange);
    diffs.push({ label: 'Retirement Discretionary', baseline: usd(baseline.expenseProfile.retirementDiscretionary), scenario: `${usd(newVal)} (${overrides.retirementDiscretionaryPctChange > 0 ? '+' : ''}${(overrides.retirementDiscretionaryPctChange * 100).toFixed(0)}%)`, changed: true });
  }

  // Savings
  if (overrides.additionalAnnualSavings !== undefined && overrides.additionalAnnualSavings > 0) {
    diffs.push({ label: 'Additional Annual Savings', baseline: '$0', scenario: usd(overrides.additionalAnnualSavings), changed: true });
  }

  return diffs;
}
