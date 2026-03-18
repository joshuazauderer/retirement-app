import { prisma } from "@/lib/prisma";
import { buildSimulationSnapshot } from "@/server/simulation/buildSimulationSnapshot";
import { runDeterministicProjection } from "@/server/simulation/runDeterministicProjection";
import { validateSimulationInputs } from "@/server/simulation/validateSimulationInputs";
import type { DeterministicProjectionResult } from "@/server/simulation/types";

export const simulationService = {
  async runAndPersist(householdId: string): Promise<{
    runId: string;
    result: DeterministicProjectionResult;
  }> {
    // Build snapshot from current household data
    const snapshot = await buildSimulationSnapshot(householdId, prisma);

    // Validate inputs before running
    const validation = validateSimulationInputs(snapshot);
    if (!validation.valid) {
      throw new Error(
        `Simulation validation failed: ${validation.errors.join("; ")}`
      );
    }

    // Run the deterministic engine
    const result = runDeterministicProjection(snapshot);
    const { summary } = result;

    // Persist results to database
    const run = await prisma.simulationRun.create({
      data: {
        householdId,
        runType: "deterministic",
        label: "Baseline Projection",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        snapshotJson: JSON.parse(JSON.stringify(snapshot)) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        outputJson: JSON.parse(JSON.stringify({ yearByYear: result.yearByYear, summary: result.summary })) as any,
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

    return { runId: run.id, result };
  },

  async getRunsForHousehold(householdId: string) {
    return prisma.simulationRun.findMany({
      where: { householdId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        runType: true,
        success: true,
        firstDepletionYear: true,
        endingBalance: true,
        endingNetWorth: true,
        projectionStartYear: true,
        projectionEndYear: true,
        yearsProjected: true,
        createdAt: true,
      },
    });
  },

  async getRunById(runId: string, householdId: string) {
    return prisma.simulationRun.findFirst({
      where: { id: runId, householdId },
    });
  },
};
