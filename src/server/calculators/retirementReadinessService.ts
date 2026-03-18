import type { SimulationSnapshot, DeterministicProjectionResult } from '@/server/simulation/types';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import type { RetirementReadinessResult } from './types';

// Readiness thresholds (documented explicitly):
// Strong: no depletion AND endingBalance >= 10% of totalWithdrawals
// Needs Attention: no depletion BUT endingBalance < 10% of totalWithdrawals
// At Risk: depletion occurs before end of horizon
const STRONG_MARGIN_RATIO = 0.1;

export function computeRetirementReadiness(
  snapshot: SimulationSnapshot,
  projectionResult?: DeterministicProjectionResult
): RetirementReadinessResult {
  const result = projectionResult ?? runDeterministicProjection(snapshot);
  const { summary, yearByYear } = result;

  let status: RetirementReadinessResult['status'];
  let statusReason: string;

  if (summary.firstDepletionYear !== null) {
    status = 'At Risk';
    statusReason = `Assets are projected to deplete in ${summary.firstDepletionYear}, ${summary.projectionEndYear - summary.firstDepletionYear} years before the end of the planning horizon.`;
  } else {
    const margin = summary.totalWithdrawals > 0 ? summary.endingBalance / summary.totalWithdrawals : 1;
    if (margin >= STRONG_MARGIN_RATIO) {
      status = 'Strong';
      statusReason = `The plan remains funded through ${summary.projectionEndYear} with meaningful assets remaining.`;
    } else {
      status = 'Needs Attention';
      statusReason = `The plan remains funded through ${summary.projectionEndYear} but the ending margin is thin. Small adverse changes could cause depletion.`;
    }
  }

  return {
    status,
    statusReason,
    success: summary.success,
    firstDepletionYear: summary.firstDepletionYear,
    firstRetirementYear: summary.firstRetirementYear,
    projectionStartYear: summary.projectionStartYear,
    projectionEndYear: summary.projectionEndYear,
    yearsFullyFunded: yearByYear.filter(y => !y.depleted).length,
    yearsProjected: summary.yearsProjected,
    endingBalance: summary.endingBalance,
    endingNetWorth: summary.endingNetWorth,
    totalWithdrawals: summary.totalWithdrawals,
    totalTaxes: summary.totalTaxes,
    summary,
  };
}
