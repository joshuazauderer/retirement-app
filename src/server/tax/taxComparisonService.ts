/**
 * Tax Comparison Service — Phase 9
 *
 * Compares two tax-planning runs to surface the tax and durability impact
 * of different strategies (withdrawal ordering, Roth conversion, state relocation, etc.).
 */

import type { TaxPlanningRunResult, TaxComparisonResult } from './types';

function fmtDollar(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function fmtYear(n: number | null): string {
  return n != null ? String(n) : 'None';
}

type Direction = 'better' | 'worse' | 'neutral';

function deltaDirection(
  deltaB: number,
  positiveMeaning: 'better' | 'worse'
): Direction {
  if (Math.abs(deltaB) < 1) return 'neutral';
  if (deltaB > 0) return positiveMeaning;
  return positiveMeaning === 'better' ? 'worse' : 'better';
}

/**
 * Compare two tax-planning runs, producing config diffs, outcome diffs,
 * and a year-by-year tax delta table.
 *
 * Convention: "better" means Run B is better for the user on that metric.
 */
export function compareTaxPlanningRuns(
  runA: TaxPlanningRunResult,
  runB: TaxPlanningRunResult
): TaxComparisonResult {
  const sa = runA.summary;
  const sb = runB.summary;

  // ---- Config diffs ----
  const configDiffs: TaxComparisonResult['configDiffs'] = [];

  if (runA.taxAssumptions.filingStatus !== runB.taxAssumptions.filingStatus) {
    configDiffs.push({ label: 'Filing Status', a: runA.taxAssumptions.filingStatus, b: runB.taxAssumptions.filingStatus });
  }
  if (runA.taxAssumptions.stateOfResidence !== runB.taxAssumptions.stateOfResidence) {
    configDiffs.push({ label: 'State of Residence', a: runA.taxAssumptions.stateOfResidence, b: runB.taxAssumptions.stateOfResidence });
  }
  const basisA = (runA.taxAssumptions.capitalGainsBasisRatio * 100).toFixed(0) + '% basis';
  const basisB = (runB.taxAssumptions.capitalGainsBasisRatio * 100).toFixed(0) + '% basis';
  if (basisA !== basisB) {
    configDiffs.push({ label: 'Capital Gains Basis Ratio', a: basisA, b: basisB });
  }
  const rothA = runA.taxAssumptions.rothConversion
    ? `$${Math.round(runA.taxAssumptions.rothConversion.annualConversionAmount).toLocaleString()}/yr (${runA.taxAssumptions.rothConversion.startYear}–${runA.taxAssumptions.rothConversion.endYear})`
    : 'None';
  const rothB = runB.taxAssumptions.rothConversion
    ? `$${Math.round(runB.taxAssumptions.rothConversion.annualConversionAmount).toLocaleString()}/yr (${runB.taxAssumptions.rothConversion.startYear}–${runB.taxAssumptions.rothConversion.endYear})`
    : 'None';
  if (rothA !== rothB) {
    configDiffs.push({ label: 'Roth Conversion', a: rothA, b: rothB });
  }

  // ---- Outcome diffs ----
  const outcomeDiffs: TaxComparisonResult['outcomeDiffs'] = [];

  const addDiff = (
    label: string,
    aVal: string,
    bVal: string,
    rawDelta: number,
    posMeaning: 'better' | 'worse'
  ) => {
    const isNeutral = Math.abs(rawDelta) < 1;
    const sign = rawDelta > 0 ? '+' : rawDelta < 0 ? '-' : '';
    outcomeDiffs.push({
      label,
      a: aVal,
      b: bVal,
      delta: isNeutral ? '—' : `${sign}${fmtDollar(rawDelta)}`,
      direction: deltaDirection(rawDelta, posMeaning),
    });
  };

  addDiff(
    'Total Federal Tax',
    fmtDollar(sa.totalFederalTax), fmtDollar(sb.totalFederalTax),
    sb.totalFederalTax - sa.totalFederalTax,
    'worse' // more tax is worse
  );
  addDiff(
    'Total State Tax',
    fmtDollar(sa.totalStateTax), fmtDollar(sb.totalStateTax),
    sb.totalStateTax - sa.totalStateTax,
    'worse'
  );
  addDiff(
    'Total Lifetime Tax',
    fmtDollar(sa.totalLifetimeTax), fmtDollar(sb.totalLifetimeTax),
    sb.totalLifetimeTax - sa.totalLifetimeTax,
    'worse'
  );
  addDiff(
    'Capital Gains Tax',
    fmtDollar(sa.totalCapitalGainsTax), fmtDollar(sb.totalCapitalGainsTax),
    sb.totalCapitalGainsTax - sa.totalCapitalGainsTax,
    'worse'
  );

  const avgA = sa.averageEffectiveRate;
  const avgB = sb.averageEffectiveRate;
  const avgDelta = avgB - avgA;
  outcomeDiffs.push({
    label: 'Avg Effective Tax Rate',
    a: fmtPct(avgA), b: fmtPct(avgB),
    delta: Math.abs(avgDelta) < 0.001 ? '—' : `${avgDelta > 0 ? '+' : ''}${(avgDelta * 100).toFixed(1)}%`,
    direction: deltaDirection(-avgDelta, 'better'), // lower rate = better
  });

  addDiff(
    'Total Withdrawals',
    fmtDollar(sa.totalWithdrawals), fmtDollar(sb.totalWithdrawals),
    sb.totalWithdrawals - sa.totalWithdrawals,
    'worse' // fewer withdrawals = better (assets last longer)
  );
  addDiff(
    'Ending Assets',
    fmtDollar(sa.endingAssets), fmtDollar(sb.endingAssets),
    sb.endingAssets - sa.endingAssets,
    'better' // more assets = better
  );

  // Depletion year
  const depA = fmtYear(sa.firstDepletionYear);
  const depB = fmtYear(sb.firstDepletionYear);
  const depDelta = (sb.firstDepletionYear ?? 9999) - (sa.firstDepletionYear ?? 9999);
  outcomeDiffs.push({
    label: 'First Depletion Year',
    a: depA, b: depB,
    delta: sa.firstDepletionYear === null && sb.firstDepletionYear === null ? '—'
      : depDelta === 0 ? '—'
      : `${depDelta > 0 ? '+' : ''}${depDelta} yr`,
    direction: sa.firstDepletionYear === null && sb.firstDepletionYear === null
      ? 'neutral'
      : depDelta > 0 ? 'better'
      : depDelta < 0 ? 'worse'
      : 'neutral',
  });

  if (sa.rothConversionYears > 0 || sb.rothConversionYears > 0) {
    addDiff(
      'Total Roth Conversion Tax',
      fmtDollar(sa.totalRothConversionTax), fmtDollar(sb.totalRothConversionTax),
      sb.totalRothConversionTax - sa.totalRothConversionTax,
      'worse'
    );
  }

  // ---- Year-by-year tax delta ----
  const yearMapA = new Map(runA.yearByYear.map((y) => [y.year, y.totalTax]));
  const yearMapB = new Map(runB.yearByYear.map((y) => [y.year, y.totalTax]));
  const allYears = [...new Set([...yearMapA.keys(), ...yearMapB.keys()])].sort();

  const yearByYearDelta = allYears.map((year) => {
    const taxA = yearMapA.get(year) ?? 0;
    const taxB = yearMapB.get(year) ?? 0;
    return { year, totalTaxA: taxA, totalTaxB: taxB, delta: taxB - taxA };
  });

  return { runA, runB, configDiffs, outcomeDiffs, yearByYearDelta };
}
