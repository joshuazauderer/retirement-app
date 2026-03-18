/**
 * Prepares a validated, Monte Carlo-ready snapshot and assumptions object
 * from a household + scenario, using the Phase 5 scenario merge layer.
 */

import { prisma } from '@/lib/prisma';
import { buildSimulationSnapshot } from '@/server/simulation/buildSimulationSnapshot';
import { validateSimulationInputs } from '@/server/simulation/validateSimulationInputs';
import { mergeScenarioOverrides } from '@/server/scenarios/scenarioSnapshotMergeService';
import { parseDecimalRate } from '@/server/simulation/normalizeInputs';
import type { ScenarioOverridePayload } from '@/server/scenarios/types';
import type { SimulationSnapshot } from '@/server/simulation/types';
import type { MonteCarloAssumptions, MonteCarloRunInput } from './types';
import { MC_BOUNDS } from './types';

export interface MonteCarloInputPrep {
  effectiveSnapshot: SimulationSnapshot;
  assumptions: MonteCarloAssumptions;
  scenarioName: string;
}

export interface MonteCarloInputValidation {
  valid: boolean;
  errors: string[];
}

export function validateMonteCarloInput(input: MonteCarloRunInput): MonteCarloInputValidation {
  const errors: string[] = [];

  const count = input.simulationCount ?? MC_BOUNDS.DEFAULT_SIMULATION_COUNT;
  if (!Number.isInteger(count) || count < MC_BOUNDS.MIN_SIMULATION_COUNT) {
    errors.push(`Simulation count must be at least ${MC_BOUNDS.MIN_SIMULATION_COUNT}.`);
  }
  if (count > MC_BOUNDS.MAX_SIMULATION_COUNT) {
    errors.push(`Simulation count cannot exceed ${MC_BOUNDS.MAX_SIMULATION_COUNT}.`);
  }

  if (input.volatilityOverride !== undefined) {
    if (input.volatilityOverride < 0 || input.volatilityOverride > 1) {
      errors.push('Volatility override must be between 0 and 1 (e.g. 0.12 for 12%).');
    }
  }
  if (input.meanReturnOverride !== undefined) {
    if (input.meanReturnOverride < -0.5 || input.meanReturnOverride > 0.5) {
      errors.push('Mean return override must be between -50% and 50%.');
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function prepareMonteCarloInput(
  input: MonteCarloRunInput
): Promise<MonteCarloInputPrep> {
  // Validate run input bounds
  const inputValidation = validateMonteCarloInput(input);
  if (!inputValidation.valid) {
    throw new Error(`Invalid Monte Carlo input: ${inputValidation.errors.join('; ')}`);
  }

  // Fetch scenario and verify household ownership
  const scenario = await prisma.scenario.findFirst({
    where: { id: input.scenarioId, householdId: input.householdId },
  });
  if (!scenario) throw new Error('Scenario not found or access denied.');

  // Fetch planning assumptions for volatility default
  const planningAssumptions = await prisma.planningAssumptions.findFirst({
    where: { householdId: input.householdId },
  });

  // Build baseline snapshot
  const baselineSnapshot = await buildSimulationSnapshot(input.householdId, prisma);

  // Validate baseline
  const validation = validateSimulationInputs(baselineSnapshot);
  if (!validation.valid) {
    throw new Error(`Household data invalid: ${validation.errors.join('; ')}`);
  }

  // Apply scenario overrides
  const overrides = scenario.overridesJson as ScenarioOverridePayload | null;
  const effectiveSnapshot = mergeScenarioOverrides(
    baselineSnapshot,
    overrides,
    scenario.id,
    scenario.name
  );

  // Resolve assumptions
  const meanReturn =
    input.meanReturnOverride ??
    effectiveSnapshot.planningAssumptions.expectedPortfolioReturn;

  const volatility =
    input.volatilityOverride ??
    (planningAssumptions?.expectedPortfolioVolatility
      ? parseDecimalRate(planningAssumptions.expectedPortfolioVolatility)
      : MC_BOUNDS.DEFAULT_VOLATILITY);

  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const simulationCount = input.simulationCount ?? MC_BOUNDS.DEFAULT_SIMULATION_COUNT;

  const assumptions: MonteCarloAssumptions = {
    meanReturn,
    volatility,
    inflationRate: effectiveSnapshot.planningAssumptions.inflationRate,
    taxRate: effectiveSnapshot.planningAssumptions.assumedEffectiveTaxRate,
    seed,
    simulationCount,
    engineVersion: MC_BOUNDS.ENGINE_VERSION,
  };

  return { effectiveSnapshot, assumptions, scenarioName: scenario.name };
}
