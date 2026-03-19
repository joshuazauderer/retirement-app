/**
 * Housing Comparison Service
 *
 * Compares two housing/legacy planning runs A vs B.
 */

import type { HousingPlanningRunResult, HousingComparisonResult } from './types';

function fmt(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function direction(delta: number, lowerIsBetter: boolean): 'better' | 'worse' | 'neutral' {
  if (Math.abs(delta) < 100) return 'neutral';
  if (lowerIsBetter) return delta < 0 ? 'better' : 'worse';
  return delta > 0 ? 'better' : 'worse';
}

export function compareHousingPlanningRuns(
  runA: HousingPlanningRunResult,
  runB: HousingPlanningRunResult,
): HousingComparisonResult {
  const a = runA.summary;
  const b = runB.summary;

  const configDiffs: HousingComparisonResult['configDiffs'] = [];
  if (runA.config.strategy !== runB.config.strategy) {
    configDiffs.push({ label: 'Housing Strategy', a: runA.config.strategy, b: runB.config.strategy });
  }
  if (runA.config.downsizing.enabled !== runB.config.downsizing.enabled) {
    configDiffs.push({
      label: 'Downsizing',
      a: runA.config.downsizing.enabled ? `Year ${runA.config.downsizing.eventYear}` : 'Disabled',
      b: runB.config.downsizing.enabled ? `Year ${runB.config.downsizing.eventYear}` : 'Disabled',
    });
  }
  if (runA.config.relocation.enabled !== runB.config.relocation.enabled) {
    configDiffs.push({
      label: 'Relocation',
      a: runA.config.relocation.enabled ? runA.config.relocation.destinationState : 'None',
      b: runB.config.relocation.enabled ? runB.config.relocation.destinationState : 'None',
    });
  }
  if (runA.config.gifting.enabled !== runB.config.gifting.enabled) {
    configDiffs.push({
      label: 'Annual Gifting',
      a: runA.config.gifting.enabled ? fmt(runA.config.gifting.annualGiftAmount) : 'Disabled',
      b: runB.config.gifting.enabled ? fmt(runB.config.gifting.annualGiftAmount) : 'Disabled',
    });
  }

  const outcomeDiffs: HousingComparisonResult['outcomeDiffs'] = [
    {
      label: 'Net Released Equity',
      a: fmt(a.netReleasedEquity), b: fmt(b.netReleasedEquity),
      delta: fmt(b.netReleasedEquity - a.netReleasedEquity),
      direction: direction(b.netReleasedEquity - a.netReleasedEquity, false),
    },
    {
      label: 'Total Lifetime Housing Cost',
      a: fmt(a.totalLifetimeHousingCost), b: fmt(b.totalLifetimeHousingCost),
      delta: fmt(b.totalLifetimeHousingCost - a.totalLifetimeHousingCost),
      direction: direction(b.totalLifetimeHousingCost - a.totalLifetimeHousingCost, true),
    },
    {
      label: 'Ending Financial Assets',
      a: fmt(a.endingFinancialAssets), b: fmt(b.endingFinancialAssets),
      delta: fmt(b.endingFinancialAssets - a.endingFinancialAssets),
      direction: direction(b.endingFinancialAssets - a.endingFinancialAssets, false),
    },
    {
      label: 'Projected Net Estate',
      a: fmt(a.projectedNetEstate), b: fmt(b.projectedNetEstate),
      delta: fmt(b.projectedNetEstate - a.projectedNetEstate),
      direction: direction(b.projectedNetEstate - a.projectedNetEstate, false),
    },
    {
      label: 'Total Lifetime Gifting',
      a: fmt(a.totalLifetimeGifting), b: fmt(b.totalLifetimeGifting),
      delta: fmt(b.totalLifetimeGifting - a.totalLifetimeGifting),
      direction: 'neutral',
    },
    {
      label: 'Plan Status',
      a: a.success ? 'Fully Funded' : `Depleted ${a.firstDepletionYear}`,
      b: b.success ? 'Fully Funded' : `Depleted ${b.firstDepletionYear}`,
      delta: '—',
      direction: b.success && !a.success ? 'better' : !b.success && a.success ? 'worse' : 'neutral',
    },
  ];

  const yearMap = new Map<number, { housingCostA: number; housingCostB: number }>();
  for (const yr of runA.yearByYear) {
    yearMap.set(yr.year, { housingCostA: yr.annualHousingCost, housingCostB: 0 });
  }
  for (const yr of runB.yearByYear) {
    const ex = yearMap.get(yr.year);
    if (ex) ex.housingCostB = yr.annualHousingCost;
    else yearMap.set(yr.year, { housingCostA: 0, housingCostB: yr.annualHousingCost });
  }

  const yearByYearDelta = Array.from(yearMap.entries())
    .sort((x, y) => x[0] - y[0])
    .map(([year, { housingCostA, housingCostB }]) => ({
      year, housingCostA, housingCostB, delta: housingCostB - housingCostA,
    }));

  return {
    runA: { runId: runA.runId, label: runA.label },
    runB: { runId: runB.runId, label: runB.label },
    configDiffs,
    outcomeDiffs,
    yearByYearDelta,
  };
}
