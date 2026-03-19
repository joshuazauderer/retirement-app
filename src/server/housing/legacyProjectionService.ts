/**
 * Legacy Projection Service
 *
 * Estimates projected estate / legacy value at end of retirement plan.
 * Combines financial assets, real-estate equity, and liabilities.
 *
 * This is a planning-grade estimate only.
 * Not legal estate-planning software.
 * Does not account for estate taxes, probate, trust structures, or beneficiary designations.
 */

import type { LegacyProjectionResult, HousingYearResult } from './types';

/**
 * Compute projected legacy value at a given year.
 */
export function computeLegacyProjection(
  endingFinancialAssets: number,
  endingRealEstateEquity: number,
  endingLiabilities: number,
  totalLifetimeGifting: number,
  projectionYear: number,
): LegacyProjectionResult {
  const projectedNetEstate = Math.max(
    0,
    endingFinancialAssets + endingRealEstateEquity - endingLiabilities,
  );

  return {
    projectionYear,
    endingFinancialAssets,
    endingRealEstateEquity,
    endingLiabilities,
    projectedNetEstate,
    totalLifetimeGifting,
    note: buildLegacyNote(projectedNetEstate, totalLifetimeGifting),
  };
}

/**
 * Extract legacy projection from the final year of a projection run.
 */
export function extractLegacyFromYearByYear(
  yearByYear: HousingYearResult[],
  totalLifetimeGifting: number,
): LegacyProjectionResult | undefined {
  if (yearByYear.length === 0) return undefined;

  const lastYear = yearByYear[yearByYear.length - 1];

  return computeLegacyProjection(
    lastYear.endingAssets,
    lastYear.estimatedRealEstateEquity,
    lastYear.estimatedMortgageBalance,
    totalLifetimeGifting,
    lastYear.year,
  );
}

/**
 * Compare legacy outcomes between two runs.
 */
export function compareLegacyOutcomes(
  legacyA: LegacyProjectionResult,
  legacyB: LegacyProjectionResult,
): {
  netEstateDelta: number;
  financialAssetDelta: number;
  realEstateDelta: number;
  giftingDelta: number;
  direction: 'better' | 'worse' | 'neutral';
} {
  const netEstateDelta = legacyB.projectedNetEstate - legacyA.projectedNetEstate;
  return {
    netEstateDelta,
    financialAssetDelta: legacyB.endingFinancialAssets - legacyA.endingFinancialAssets,
    realEstateDelta: legacyB.endingRealEstateEquity - legacyA.endingRealEstateEquity,
    giftingDelta: legacyB.totalLifetimeGifting - legacyA.totalLifetimeGifting,
    direction: Math.abs(netEstateDelta) < 1000 ? 'neutral' : netEstateDelta > 0 ? 'better' : 'worse',
  };
}

function buildLegacyNote(projectedNetEstate: number, totalGifting: number): string {
  const parts: string[] = [
    'Planning-grade estimate only. Does not account for estate taxes, probate, trust structures, or exact beneficiary designations.',
  ];
  if (totalGifting > 0) {
    parts.push(`Lifetime gifting of $${Math.round(totalGifting).toLocaleString()} is excluded from the projected estate value.`);
  }
  if (projectedNetEstate === 0) {
    parts.push('Assets are projected to be depleted before end of plan horizon.');
  }
  return parts.join(' ');
}
