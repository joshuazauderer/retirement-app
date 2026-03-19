import type { HealthcarePlanningRunResult, HealthcareComparisonResult } from './types';

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function direction(
  delta: number,
  lowerIsBetter: boolean,
): 'better' | 'worse' | 'neutral' {
  if (Math.abs(delta) < 50) return 'neutral';
  if (lowerIsBetter) return delta < 0 ? 'better' : 'worse';
  return delta > 0 ? 'better' : 'worse';
}

export function compareHealthcarePlanningRuns(
  runA: HealthcarePlanningRunResult,
  runB: HealthcarePlanningRunResult,
): HealthcareComparisonResult {
  const a = runA.summary;
  const b = runB.summary;
  const ca = runA.config;
  const cb = runB.config;

  const configDiffs: HealthcareComparisonResult['configDiffs'] = [];

  if (ca.healthcareInflationRate !== cb.healthcareInflationRate) {
    configDiffs.push({
      label: 'Healthcare Inflation Rate',
      a: fmtPct(ca.healthcareInflationRate),
      b: fmtPct(cb.healthcareInflationRate),
    });
  }
  if (ca.medicareEligibilityAge !== cb.medicareEligibilityAge) {
    configDiffs.push({
      label: 'Medicare Eligibility Age',
      a: String(ca.medicareEligibilityAge),
      b: String(cb.medicareEligibilityAge),
    });
  }
  if (ca.ltcStress.enabled !== cb.ltcStress.enabled) {
    configDiffs.push({
      label: 'LTC Stress',
      a: ca.ltcStress.enabled
        ? `Enabled (age ${ca.ltcStress.startAge}, ${ca.ltcStress.durationYears} yrs, ${fmt(ca.ltcStress.annualCost)}/yr)`
        : 'Disabled',
      b: cb.ltcStress.enabled
        ? `Enabled (age ${cb.ltcStress.startAge}, ${cb.ltcStress.durationYears} yrs, ${fmt(cb.ltcStress.annualCost)}/yr)`
        : 'Disabled',
    });
  }
  if (
    ca.longevityStress.enabled !== cb.longevityStress.enabled ||
    ca.longevityStress.targetAge !== cb.longevityStress.targetAge
  ) {
    configDiffs.push({
      label: 'Longevity Stress',
      a: ca.longevityStress.enabled ? `To age ${ca.longevityStress.targetAge}` : 'Disabled',
      b: cb.longevityStress.enabled ? `To age ${cb.longevityStress.targetAge}` : 'Disabled',
    });
  }

  const outcomeDiffs: HealthcareComparisonResult['outcomeDiffs'] = [
    {
      label: 'Total Healthcare Cost',
      a: fmt(a.totalHealthcareCost),
      b: fmt(b.totalHealthcareCost),
      delta: fmt(b.totalHealthcareCost - a.totalHealthcareCost),
      direction: direction(b.totalHealthcareCost - a.totalHealthcareCost, true),
    },
    {
      label: 'Total LTC Cost',
      a: fmt(a.totalLtcCost),
      b: fmt(b.totalLtcCost),
      delta: fmt(b.totalLtcCost - a.totalLtcCost),
      direction: direction(b.totalLtcCost - a.totalLtcCost, true),
    },
    {
      label: 'Peak Annual Healthcare Cost',
      a: fmt(a.peakAnnualHealthcareCost),
      b: fmt(b.peakAnnualHealthcareCost),
      delta: fmt(b.peakAnnualHealthcareCost - a.peakAnnualHealthcareCost),
      direction: direction(b.peakAnnualHealthcareCost - a.peakAnnualHealthcareCost, true),
    },
    {
      label: 'Average Annual Healthcare Cost',
      a: fmt(a.averageAnnualHealthcareCost),
      b: fmt(b.averageAnnualHealthcareCost),
      delta: fmt(b.averageAnnualHealthcareCost - a.averageAnnualHealthcareCost),
      direction: direction(b.averageAnnualHealthcareCost - a.averageAnnualHealthcareCost, true),
    },
    {
      label: 'Ending Assets',
      a: fmt(a.endingAssets),
      b: fmt(b.endingAssets),
      delta: fmt(b.endingAssets - a.endingAssets),
      direction: direction(b.endingAssets - a.endingAssets, false),
    },
    {
      label: 'Longevity Extension',
      a: `${a.longevityExtensionYears} yrs`,
      b: `${b.longevityExtensionYears} yrs`,
      delta: `${b.longevityExtensionYears - a.longevityExtensionYears} yrs`,
      direction: 'neutral',
    },
    {
      label: 'Plan Status',
      a: a.success ? 'Fully Funded' : `Depleted ${a.firstDepletionYear}`,
      b: b.success ? 'Fully Funded' : `Depleted ${b.firstDepletionYear}`,
      delta: '—',
      direction:
        b.success && !a.success ? 'better' : !b.success && a.success ? 'worse' : 'neutral',
    },
  ];

  // Year-by-year delta
  const yearMap = new Map<number, { costA: number; costB: number }>();
  for (const yr of runA.yearByYear) {
    yearMap.set(yr.year, { costA: yr.totalHealthcareCost, costB: 0 });
  }
  for (const yr of runB.yearByYear) {
    const existing = yearMap.get(yr.year);
    if (existing) {
      existing.costB = yr.totalHealthcareCost;
    } else {
      yearMap.set(yr.year, { costA: 0, costB: yr.totalHealthcareCost });
    }
  }

  const yearByYearDelta = Array.from(yearMap.entries())
    .sort((x, y) => x[0] - y[0])
    .map(([year, { costA, costB }]) => ({
      year,
      costA,
      costB,
      delta: costB - costA,
    }));

  return {
    runA: { runId: runA.runId, label: runA.label },
    runB: { runId: runB.runId, label: runB.label },
    configDiffs,
    outcomeDiffs,
    yearByYearDelta,
  };
}
