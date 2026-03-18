import type { ScenarioOverridePayload } from './types';

export interface ScenarioTemplate {
  id: string;
  label: string;
  description: string;
  scenarioType: string;
  buildOverrides: (context: {
    primaryMemberRetirementAge: number;
    currentDiscretionary: number;
    currentSavings: number;
    currentInflation: number;
    currentReturn: number;
  }) => ScenarioOverridePayload;
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'retire_earlier',
    label: 'Retire 2 Years Earlier',
    description: 'What happens if you retire 2 years earlier than planned?',
    scenarioType: 'EARLY_RETIREMENT',
    buildOverrides: ({ primaryMemberRetirementAge }) => ({
      memberOverrides: [{ memberId: '__PRIMARY__', retirementAgeOverride: primaryMemberRetirementAge - 2 }],
    }),
  },
  {
    id: 'retire_later',
    label: 'Retire 2 Years Later',
    description: 'What happens if you work 2 more years before retiring?',
    scenarioType: 'DELAYED_RETIREMENT',
    buildOverrides: ({ primaryMemberRetirementAge }) => ({
      memberOverrides: [{ memberId: '__PRIMARY__', retirementAgeOverride: primaryMemberRetirementAge + 2 }],
    }),
  },
  {
    id: 'lower_spending',
    label: 'Reduce Retirement Spending by 10%',
    description: 'What if you spend 10% less in retirement?',
    scenarioType: 'LOWER_SPENDING',
    buildOverrides: () => ({ retirementDiscretionaryPctChange: -0.10 }),
  },
  {
    id: 'higher_spending',
    label: 'Increase Retirement Spending by 10%',
    description: 'What if you spend 10% more in retirement?',
    scenarioType: 'HIGHER_SPENDING',
    buildOverrides: () => ({ retirementDiscretionaryPctChange: 0.10 }),
  },
  {
    id: 'more_savings',
    label: 'Save an Additional $10,000/Year',
    description: 'What if you increase annual savings by $10,000?',
    scenarioType: 'HIGHER_SAVINGS',
    buildOverrides: () => ({ additionalAnnualSavings: 10_000 }),
  },
  {
    id: 'higher_inflation',
    label: 'Higher Inflation (4.5%)',
    description: 'What if inflation runs higher than expected?',
    scenarioType: 'HIGHER_INFLATION',
    buildOverrides: () => ({ inflationRateOverride: 0.045 }),
  },
];
