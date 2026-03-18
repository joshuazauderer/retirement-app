/**
 * Orchestrates a full Monte Carlo run: input prep → path execution → aggregation → persistence.
 * Also provides retrieval methods for list and detail views.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { prepareMonteCarloInput } from './monteCarloInputService';
import { runMonteCarloPaths } from './monteCarloProjectionService';
import { aggregatePaths } from './monteCarloAggregationService';
import type { MonteCarloRunInput, MonteCarloRunResult, MonteCarloListItem } from './types';

export const monteCarloRunService = {
  /**
   * Execute a full Monte Carlo simulation and persist results.
   * Returns the aggregated run result (does NOT return raw path data).
   */
  async run(input: MonteCarloRunInput): Promise<MonteCarloRunResult> {
    const { effectiveSnapshot, assumptions, scenarioName } =
      await prepareMonteCarloInput(input);

    // Run all paths (synchronous — acceptable at 1000 paths on VPS)
    const pathSummaries = runMonteCarloPaths(effectiveSnapshot, assumptions);

    // Aggregate
    const aggregation = aggregatePaths(
      pathSummaries,
      assumptions,
      effectiveSnapshot.timeline.simulationYearStart,
      effectiveSnapshot.timeline.projectionEndYear,
      effectiveSnapshot.members
    );

    // Persist
    const run = await prisma.monteCarloRun.create({
      data: {
        householdId: input.householdId,
        scenarioId: input.scenarioId,
        label: scenarioName,
        seed: assumptions.seed,
        simulationCount: assumptions.simulationCount,
        engineVersion: assumptions.engineVersion,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assumptionsJson: JSON.parse(JSON.stringify(assumptions)) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        snapshotJson: JSON.parse(JSON.stringify(effectiveSnapshot)) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        aggregationJson: JSON.parse(JSON.stringify(aggregation)) as any,
        successProbability: aggregation.success.successProbability.toFixed(4),
        failureProbability: aggregation.success.failureProbability.toFixed(4),
        medianEndingAssets: aggregation.endingAssets.p50.toFixed(2),
        p10EndingAssets: aggregation.endingAssets.p10.toFixed(2),
        p90EndingAssets: aggregation.endingAssets.p90.toFixed(2),
        medianDepletionYear: aggregation.success.medianDepletionYear,
        projectionStartYear: aggregation.projectionStartYear,
        projectionEndYear: aggregation.projectionEndYear,
      },
    });

    return {
      runId: run.id,
      householdId: run.householdId,
      scenarioId: run.scenarioId,
      scenarioName,
      label: run.label,
      seed: run.seed,
      simulationCount: run.simulationCount,
      engineVersion: run.engineVersion,
      assumptions,
      aggregation,
      createdAt: run.createdAt.toISOString(),
    };
  },

  async listForHousehold(householdId: string): Promise<MonteCarloListItem[]> {
    const runs = await prisma.monteCarloRun.findMany({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
    });

    return runs.map(r => ({
      runId: r.id,
      label: r.label,
      scenarioId: r.scenarioId,
      scenarioName: r.label ?? 'Unknown',
      simulationCount: r.simulationCount,
      seed: r.seed,
      successProbability: Number(r.successProbability),
      medianEndingAssets: Number(r.medianEndingAssets),
      projectionStartYear: r.projectionStartYear,
      projectionEndYear: r.projectionEndYear,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  async getById(runId: string, householdId: string): Promise<MonteCarloRunResult | null> {
    const run = await prisma.monteCarloRun.findFirst({
      where: { id: runId, householdId },
    });
    if (!run) return null;

    const assumptions = run.assumptionsJson as unknown as import('./types').MonteCarloAssumptions;
    const aggregation = run.aggregationJson as unknown as import('./types').MonteCarloAggregationResult;

    return {
      runId: run.id,
      householdId: run.householdId,
      scenarioId: run.scenarioId,
      scenarioName: run.label ?? 'Unknown',
      label: run.label,
      seed: run.seed,
      simulationCount: run.simulationCount,
      engineVersion: run.engineVersion,
      assumptions,
      aggregation,
      createdAt: run.createdAt.toISOString(),
    };
  },
};
