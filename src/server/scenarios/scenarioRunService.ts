import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '@/server/simulation/buildSimulationSnapshot';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import { validateSimulationInputs } from '@/server/simulation/validateSimulationInputs';
import { mergeScenarioOverrides } from './scenarioSnapshotMergeService';
import type { ScenarioOverridePayload } from './types';

export const scenarioRunService = {
  async runScenario(scenarioId: string, householdId: string): Promise<{
    runId: string;
    success: boolean;
    firstDepletionYear: number | null;
    endingBalance: number;
  }> {
    // Fetch scenario and verify ownership
    const scenario = await prisma.scenario.findFirst({
      where: { id: scenarioId, householdId },
    });
    if (!scenario) throw new Error('Scenario not found');

    // Build baseline snapshot
    const baselineSnapshot = await buildSimulationSnapshot(householdId, prisma);

    // Validate baseline
    const validation = validateSimulationInputs(baselineSnapshot);
    if (!validation.valid) throw new Error(`Validation failed: ${validation.errors.join('; ')}`);

    // Merge overrides
    const overrides = scenario.overridesJson as ScenarioOverridePayload | null;
    const effectiveSnapshot = mergeScenarioOverrides(baselineSnapshot, overrides, scenarioId, scenario.name);

    // Run engine
    const result = runDeterministicProjection(effectiveSnapshot);
    const { summary } = result;

    // Persist run linked to scenario
    const run = await prisma.simulationRun.create({
      data: {
        householdId,
        scenarioId,
        runType: 'deterministic',
        label: scenario.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        snapshotJson: JSON.parse(JSON.stringify(effectiveSnapshot)) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outputJson: JSON.parse(JSON.stringify({ yearByYear: result.yearByYear, summary })) as any,
        success: summary.success,
        firstDepletionYear: summary.firstDepletionYear,
        endingBalance: summary.endingBalance.toFixed(2),
        endingNetWorth: summary.endingNetWorth.toFixed(2),
        totalWithdrawals: summary.totalWithdrawals.toFixed(2),
        totalTaxes: summary.totalTaxes.toFixed(2),
        projectionStartYear: summary.projectionStartYear,
        projectionEndYear: summary.projectionEndYear,
        yearsProjected: summary.yearsProjected,
      },
    });

    return {
      runId: run.id,
      success: summary.success,
      firstDepletionYear: summary.firstDepletionYear,
      endingBalance: summary.endingBalance,
    };
  },
};
