/**
 * contextBuilderService — assemble household context for the conversation session.
 *
 * Fetches recent run summaries from DB to populate the conversation context.
 * This gives the AI enough grounding to answer questions without re-running simulations.
 */

import { prisma } from '@/lib/prisma';
import type { ConversationContext } from './types';

/**
 * Build conversation context from DB for a household.
 * Fetches the most recent runs of each type to populate planSummary.
 */
export async function buildConversationContext(
  householdId: string,
  userId: string,
  activeScenarioId?: string,
): Promise<ConversationContext> {
  // Verify household access
  const household = await prisma.household.findFirst({
    where: { id: householdId, primaryUserId: userId },
    include: {
      scenarios: { orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, name: true } },
    },
  });

  if (!household) {
    return {
      householdId,
      recentIntents: [],
    };
  }

  const scenarioId = activeScenarioId ?? household.scenarios[0]?.id;

  // Try to get plan summary from most recent tax planning run
  let planSummary: ConversationContext['planSummary'];
  try {
    const latestTaxRun = await prisma.taxPlanningRun.findFirst({
      where: { householdId, ...(scenarioId ? { scenarioId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { scenario: { select: { name: true } } },
    });

    if (latestTaxRun) {
      planSummary = {
        success: latestTaxRun.success,
        firstDepletionYear: latestTaxRun.firstDepletionYear ?? undefined,
        endingAssets: 0, // Tax run doesn't store endingAssets directly — use 0 placeholder
        scenarioName: latestTaxRun.scenario?.name ?? 'Default Scenario',
      };
    }
  } catch {
    // Non-fatal
  }

  // Try healthcare run if no tax run
  if (!planSummary) {
    try {
      const latestHealthcareRun = await prisma.healthcarePlanningRun.findFirst({
        where: { householdId },
        orderBy: { createdAt: 'desc' },
        include: { scenario: { select: { name: true } } },
      });
      if (latestHealthcareRun) {
        planSummary = {
          success: latestHealthcareRun.success,
          firstDepletionYear: latestHealthcareRun.firstDepletionYear ?? undefined,
          endingAssets: latestHealthcareRun.endingAssets,
          scenarioName: latestHealthcareRun.scenario?.name ?? 'Default Scenario',
        };
      }
    } catch {
      // Non-fatal
    }
  }

  // Try housing run
  if (!planSummary) {
    try {
      const latestHousingRun = await prisma.housingPlanningRun.findFirst({
        where: { householdId },
        orderBy: { createdAt: 'desc' },
        include: { scenario: { select: { name: true } } },
      });
      if (latestHousingRun) {
        planSummary = {
          success: latestHousingRun.success,
          firstDepletionYear: latestHousingRun.firstDepletionYear ?? undefined,
          endingAssets: latestHousingRun.endingFinancialAssets,
          scenarioName: latestHousingRun.scenario?.name ?? 'Default Scenario',
        };
      }
    } catch {
      // Non-fatal
    }
  }

  return {
    householdId,
    activeScenarioId: scenarioId,
    recentIntents: [],
    planSummary,
  };
}

/**
 * Build a concise system context string for the AI prompt.
 * This gives the AI grounding without overwhelming the context window.
 */
export function buildSystemContextString(context: ConversationContext): string {
  const lines: string[] = [
    `Household ID: ${context.householdId}`,
  ];

  if (context.planSummary) {
    const { success, firstDepletionYear, endingAssets, scenarioName } = context.planSummary;
    lines.push(`Active Scenario: ${scenarioName}`);
    lines.push(`Plan Status: ${success ? 'Fully Funded' : `Depleted in ${firstDepletionYear ?? 'unknown year'}`}`);
    if (endingAssets > 0) {
      lines.push(`Ending Assets: $${Math.round(endingAssets).toLocaleString()}`);
    }
  } else {
    lines.push('No simulation runs found yet for this household. Encourage the user to run a scenario first.');
  }

  if (context.activeScenarioId) {
    lines.push(`Active Scenario ID: ${context.activeScenarioId}`);
  }

  return lines.join('\n');
}
