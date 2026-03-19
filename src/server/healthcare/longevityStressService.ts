// Longevity extension stress testing

import type { LongevityStressConfig } from './types';
import type { SimulationSnapshot } from '../simulation/types';

/**
 * Get the primary member's current age from the snapshot.
 */
export function getPrimaryAge(snapshot: SimulationSnapshot): number {
  const primary = snapshot.members.find((m) => m.isPrimary) ?? snapshot.members[0];
  return primary?.currentAge ?? 0;
}

/**
 * Get the spouse's current age from the snapshot, or undefined if no spouse.
 */
export function getSpouseAge(snapshot: SimulationSnapshot): number | undefined {
  const spouse = snapshot.members.find((m) => !m.isPrimary);
  return spouse?.currentAge;
}

/**
 * Apply longevity stress by extending the simulation timeline.
 * Returns a modified snapshot with an extended end year.
 */
export function applyLongevityStress(
  snapshot: SimulationSnapshot,
  config: LongevityStressConfig,
): { snapshot: SimulationSnapshot; extensionYears: number } {
  if (!config.enabled) return { snapshot, extensionYears: 0 };

  const currentYear = snapshot.timeline.simulationYearStart;
  const currentEndYear = snapshot.timeline.projectionEndYear;

  const primaryAge = getPrimaryAge(snapshot);
  const primaryAgeAtEnd = primaryAge + (currentEndYear - currentYear);

  let targetEndYear = currentEndYear;

  if (config.person === 'primary' || config.person === 'both') {
    const yearsToTarget = config.targetAge - primaryAgeAtEnd;
    if (yearsToTarget > 0) {
      targetEndYear = Math.max(targetEndYear, currentEndYear + yearsToTarget);
    }
  }

  const spouseAge = getSpouseAge(snapshot);
  if ((config.person === 'spouse' || config.person === 'both') && spouseAge != null) {
    const spouseAgeAtEnd = spouseAge + (currentEndYear - currentYear);
    const yearsToTarget = config.targetAge - spouseAgeAtEnd;
    if (yearsToTarget > 0) {
      targetEndYear = Math.max(targetEndYear, currentEndYear + yearsToTarget);
    }
  }

  const extensionYears = Math.max(0, targetEndYear - currentEndYear);

  if (extensionYears === 0) return { snapshot, extensionYears: 0 };

  const extendedSnapshot: SimulationSnapshot = {
    ...snapshot,
    timeline: {
      ...snapshot.timeline,
      projectionEndYear: targetEndYear,
    },
  };

  return { snapshot: extendedSnapshot, extensionYears };
}

/**
 * Compute what age the primary person would be at a given year.
 */
export function primaryAgeInYear(snapshot: SimulationSnapshot, year: number): number {
  const primaryAge = getPrimaryAge(snapshot);
  return primaryAge + (year - snapshot.timeline.simulationYearStart);
}

/**
 * Compute what age the spouse would be at a given year (or undefined if no spouse).
 */
export function spouseAgeInYear(snapshot: SimulationSnapshot, year: number): number | undefined {
  const spouseAge = getSpouseAge(snapshot);
  if (spouseAge == null) return undefined;
  return spouseAge + (year - snapshot.timeline.simulationYearStart);
}
