import { prisma } from '@/lib/prisma';
import type { ScenarioOverridePayload, ScenarioSummary } from './types';
import { validateOverrides } from './scenarioOverrideService';

export const scenarioService = {
  async listForHousehold(householdId: string): Promise<ScenarioSummary[]> {
    const scenarios = await prisma.scenario.findMany({
      where: { householdId, status: 'ACTIVE' },
      orderBy: [{ isBaseline: 'desc' }, { updatedAt: 'desc' }],
      include: {
        simulationRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true, success: true, firstDepletionYear: true,
            endingBalance: true, endingNetWorth: true,
            projectionStartYear: true, projectionEndYear: true,
            createdAt: true,
          },
        },
      },
    });

    return scenarios.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      scenarioType: s.scenarioType,
      status: s.status,
      isBaseline: s.isBaseline,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      latestRun: s.simulationRuns[0]
        ? {
            id: s.simulationRuns[0].id,
            success: s.simulationRuns[0].success,
            firstDepletionYear: s.simulationRuns[0].firstDepletionYear,
            endingBalance: s.simulationRuns[0].endingBalance.toString(),
            endingNetWorth: s.simulationRuns[0].endingNetWorth.toString(),
            projectionStartYear: s.simulationRuns[0].projectionStartYear,
            projectionEndYear: s.simulationRuns[0].projectionEndYear,
            createdAt: s.simulationRuns[0].createdAt.toISOString(),
          }
        : null,
    }));
  },

  async getById(scenarioId: string, householdId: string) {
    return prisma.scenario.findFirst({
      where: { id: scenarioId, householdId },
      include: {
        simulationRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  },

  async create(householdId: string, data: {
    name: string;
    description?: string;
    scenarioType?: string;
    overrides?: ScenarioOverridePayload;
    isBaseline?: boolean;
    sourceScenarioId?: string;
  }) {
    if (data.overrides) {
      const v = validateOverrides(data.overrides);
      if (!v.valid) throw new Error(`Invalid overrides: ${v.errors.join('; ')}`);
    }

    // If setting as baseline, unset other baselines
    if (data.isBaseline) {
      await prisma.scenario.updateMany({
        where: { householdId, isBaseline: true },
        data: { isBaseline: false },
      });
    }

    return prisma.scenario.create({
      data: {
        householdId,
        name: data.name,
        description: data.description ?? null,
        scenarioType: data.scenarioType ?? 'CUSTOM',
        isBaseline: data.isBaseline ?? false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overridesJson: data.overrides ? (JSON.parse(JSON.stringify(data.overrides)) as any) : null,
        sourceScenarioId: data.sourceScenarioId ?? null,
        status: 'ACTIVE',
      },
    });
  },

  async update(scenarioId: string, householdId: string, data: {
    name?: string;
    description?: string;
    overrides?: ScenarioOverridePayload | null;
  }) {
    // Verify ownership
    const existing = await prisma.scenario.findFirst({ where: { id: scenarioId, householdId } });
    if (!existing) throw new Error('Scenario not found');

    if (data.overrides) {
      const v = validateOverrides(data.overrides);
      if (!v.valid) throw new Error(`Invalid overrides: ${v.errors.join('; ')}`);
    }

    return prisma.scenario.update({
      where: { id: scenarioId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.overrides !== undefined && {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          overridesJson: data.overrides ? (JSON.parse(JSON.stringify(data.overrides)) as any) : null,
        }),
      },
    });
  },

  async duplicate(scenarioId: string, householdId: string, newName?: string) {
    const source = await prisma.scenario.findFirst({ where: { id: scenarioId, householdId } });
    if (!source) throw new Error('Source scenario not found');

    return prisma.scenario.create({
      data: {
        householdId,
        name: newName ?? `${source.name} (Copy)`,
        description: source.description,
        scenarioType: source.scenarioType,
        isBaseline: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overridesJson: source.overridesJson as any,
        sourceScenarioId: source.id,
        status: 'ACTIVE',
      },
    });
  },

  async setBaseline(scenarioId: string, householdId: string) {
    const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, householdId } });
    if (!scenario) throw new Error('Scenario not found');

    await prisma.scenario.updateMany({
      where: { householdId, isBaseline: true },
      data: { isBaseline: false },
    });
    return prisma.scenario.update({
      where: { id: scenarioId },
      data: { isBaseline: true },
    });
  },

  async archive(scenarioId: string, householdId: string) {
    const scenario = await prisma.scenario.findFirst({ where: { id: scenarioId, householdId } });
    if (!scenario) throw new Error('Scenario not found');
    if (scenario.isBaseline) throw new Error('Cannot archive the baseline scenario. Set another scenario as baseline first.');

    return prisma.scenario.update({
      where: { id: scenarioId },
      data: { status: 'ARCHIVED' },
    });
  },

  // Ensure at least one baseline scenario exists for the household
  async ensureBaseline(householdId: string) {
    const existing = await prisma.scenario.findFirst({
      where: { householdId, isBaseline: true, status: 'ACTIVE' },
    });
    if (existing) return existing;

    // Create a default baseline
    return prisma.scenario.create({
      data: {
        householdId,
        name: 'Baseline Plan',
        description: 'Current plan with no adjustments.',
        scenarioType: 'BASELINE',
        isBaseline: true,
        overridesJson: null,
        status: 'ACTIVE',
      },
    });
  },
};
