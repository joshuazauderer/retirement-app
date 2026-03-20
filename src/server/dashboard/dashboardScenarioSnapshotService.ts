import { prisma } from '@/lib/prisma';
import type { ScenarioSnapshotSummary, ScenarioSnapshotRow } from './types';

export async function getDashboardScenarioSnapshot(householdId: string): Promise<ScenarioSnapshotSummary> {
  const scenarios = await prisma.scenario.findMany({
    where: { householdId },
    orderBy: [{ isBaseline: 'desc' }, { createdAt: 'asc' }],
    take: 4,
    include: {
      simulationRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          endingBalance: true,
          firstDepletionYear: true,
          projectionEndYear: true,
          success: true,
        },
      },
    },
  });

  if (scenarios.length === 0) {
    return { hasScenarios: false, scenarios: [] };
  }

  const rows: ScenarioSnapshotRow[] = scenarios.map(s => {
    const run = s.simulationRuns[0] ?? null;
    const depletionYear = run?.firstDepletionYear ?? null;
    const endYear = run?.projectionEndYear ?? null;
    const endBalance = run ? Number(run.endingBalance) : null;

    let outcome = 'Not yet run';
    if (run) {
      if (depletionYear) {
        outcome = `May run out in ${depletionYear}`;
      } else if (endBalance !== null && endBalance > 0) {
        outcome = `Ends with ${fmtCurrency(endBalance)}`;
      } else {
        outcome = 'Funded through retirement';
      }
    }

    return {
      id: s.id,
      name: s.name,
      outcome,
      isBaseline: s.isBaseline,
      endingBalance: endBalance,
      firstDepletionYear: depletionYear,
      projectionEndYear: endYear,
    };
  });

  return { hasScenarios: true, scenarios: rows };
}

function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
