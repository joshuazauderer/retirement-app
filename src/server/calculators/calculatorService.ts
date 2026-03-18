import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '@/server/simulation/buildSimulationSnapshot';
import { runDeterministicProjection } from '@/server/simulation/runDeterministicProjection';
import { validateSimulationInputs } from '@/server/simulation/validateSimulationInputs';
import { computeRetirementReadiness } from './retirementReadinessService';
import { computeSavingsGap } from './savingsGapService';
import { computeRetirementIncomeProjection } from './retirementIncomeProjectionService';
import { computeWithdrawalCalculator } from './withdrawalCalculatorService';
import { computeYearsUntilRetirement } from './yearsUntilRetirementService';

export const calculatorService = {
  async getReadiness(householdId: string) {
    const snapshot = await buildSimulationSnapshot(householdId, prisma);
    const validation = validateSimulationInputs(snapshot);
    if (!validation.valid) return { validation, result: null };
    const projection = runDeterministicProjection(snapshot);
    return { validation, result: computeRetirementReadiness(snapshot, projection) };
  },

  async getSavingsGap(householdId: string) {
    const snapshot = await buildSimulationSnapshot(householdId, prisma);
    const validation = validateSimulationInputs(snapshot);
    if (!validation.valid) return { validation, result: null };
    return { validation, result: computeSavingsGap(snapshot) };
  },

  async getIncomeProjection(householdId: string) {
    const snapshot = await buildSimulationSnapshot(householdId, prisma);
    const validation = validateSimulationInputs(snapshot);
    if (!validation.valid) return { validation, result: null };
    const projection = runDeterministicProjection(snapshot);
    return { validation, result: computeRetirementIncomeProjection(snapshot, projection) };
  },

  async getWithdrawalCalculator(householdId: string) {
    const snapshot = await buildSimulationSnapshot(householdId, prisma);
    const validation = validateSimulationInputs(snapshot);
    if (!validation.valid) return { validation, result: null };
    const projection = runDeterministicProjection(snapshot);
    return { validation, result: computeWithdrawalCalculator(snapshot, projection) };
  },

  async getYearsUntilRetirement(householdId: string) {
    const snapshot = await buildSimulationSnapshot(householdId, prisma);
    const validation = validateSimulationInputs(snapshot);
    if (!validation.valid) return { validation, result: null };
    const projection = runDeterministicProjection(snapshot);
    return { validation, result: computeYearsUntilRetirement(snapshot, projection) };
  },
};
