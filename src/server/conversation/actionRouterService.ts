/**
 * actionRouterService — route parsed intents to existing engine services.
 *
 * This is the "Structured Action" layer. It calls existing deterministic services
 * based on the parsed intent and returns structured data.
 *
 * CRITICAL: No financial calculations here. Only routing to existing services.
 */

import { prisma } from '@/lib/prisma';
import { computeRiskFlags, analyzeRisks } from '../ai/riskAnalysisService';
import { selectRecommendations } from '../ai/recommendationService';
import { CONCEPT_EXPLANATIONS } from './types';
import type { ParsedIntent, ActionResult } from './types';

/**
 * Route a parsed intent to the appropriate action and return structured data.
 */
export async function routeAction(
  intent: ParsedIntent,
  householdId: string,
  userId: string,
): Promise<ActionResult> {
  try {
    switch (intent.actionType) {
      case 'FETCH_PLAN_SUMMARY':
        return await fetchPlanSummary(householdId, userId);

      case 'FETCH_RISK_ANALYSIS':
        return await fetchRiskAnalysis(householdId, userId);

      case 'FETCH_RECOMMENDATIONS':
        return await fetchRecommendations(householdId, userId);

      case 'FETCH_TAX_SUMMARY':
        return await fetchTaxSummary(householdId, userId);

      case 'FETCH_HEALTHCARE_SUMMARY':
        return await fetchHealthcareSummary(householdId, userId);

      case 'FETCH_HOUSING_SUMMARY':
        return await fetchHousingSummary(householdId, userId);

      case 'FETCH_SCENARIO_COMPARISON': {
        const result = await fetchPlanSummary(householdId, userId);
        if (result.success) {
          result.summary = 'Scenario comparison requires two specific scenarios. Here is the current plan summary for reference.';
        }
        return result;
      }

      case 'EXPLAIN_CONCEPT': {
        const concept = intent.parameters.concept as string | undefined;
        if (concept && concept in CONCEPT_EXPLANATIONS) {
          return {
            success: true,
            data: { concept, explanation: CONCEPT_EXPLANATIONS[concept as keyof typeof CONCEPT_EXPLANATIONS] },
            summary: `Explanation of: ${concept.replace(/_/g, ' ')}`,
          };
        }
        return { success: true, data: {}, summary: 'Concept explanation requested' };
      }

      case 'REQUEST_CLARIFICATION':
        return {
          success: true,
          data: {},
          summary: intent.clarificationQuestion ?? 'Could you rephrase your question?',
        };

      case 'NO_ACTION':
      default:
        return {
          success: true,
          data: {},
          summary: 'No specific action mapped to this request.',
        };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Action failed',
      summary: 'I was unable to retrieve the requested data.',
    };
  }
}

async function fetchPlanSummary(householdId: string, _userId: string): Promise<ActionResult> {
  // Try most recent runs in priority order
  const taxRun = await prisma.taxPlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  }).catch(() => null);

  const healthcareRun = await prisma.healthcarePlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null);

  const housingRun = await prisma.housingPlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null);

  if (!taxRun && !healthcareRun && !housingRun) {
    return {
      success: false,
      error: 'No planning runs found',
      summary: 'No simulation runs have been completed yet. Run a tax planning, healthcare, or housing analysis first to get plan insights.',
    };
  }

  const data: Record<string, unknown> = {};

  if (taxRun) {
    data.taxRun = {
      label: taxRun.label,
      scenarioName: taxRun.scenario?.name ?? 'Unknown',
      success: taxRun.success,
      firstDepletionYear: taxRun.firstDepletionYear,
      totalLifetimeTax: taxRun.totalLifetimeTax,
      createdAt: taxRun.createdAt.toISOString(),
    };
  }

  if (healthcareRun) {
    data.healthcareRun = {
      label: healthcareRun.label,
      success: healthcareRun.success,
      firstDepletionYear: healthcareRun.firstDepletionYear,
      totalHealthcareCost: healthcareRun.totalHealthcareCost,
      endingAssets: healthcareRun.endingAssets,
    };
  }

  if (housingRun) {
    data.housingRun = {
      label: housingRun.label,
      success: housingRun.success,
      firstDepletionYear: housingRun.firstDepletionYear,
      endingAssets: housingRun.endingFinancialAssets,
      netEstateValue: housingRun.projectedNetEstate,
      strategy: housingRun.strategy,
    };
  }

  const anyRun = taxRun ?? healthcareRun ?? housingRun;
  const isSuccess = anyRun ? (
    taxRun ? taxRun.success : (healthcareRun ? healthcareRun.success : housingRun!.success)
  ) : false;

  return {
    success: true,
    data,
    summary: isSuccess
      ? 'Most recent plan runs show a fully funded projection.'
      : 'One or more plan runs show depletion risk.',
  };
}

async function fetchRiskAnalysis(householdId: string, _userId: string): Promise<ActionResult> {
  const healthcareRun = await prisma.healthcarePlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null);

  const housingRun = await prisma.housingPlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null);

  const run = healthcareRun ?? housingRun;

  if (!run) {
    return {
      success: false,
      error: 'No runs found for risk analysis',
      summary: 'No planning runs found. Complete a planning analysis to see risk factors.',
    };
  }

  const endingAssets = 'endingAssets' in run ? (run as typeof healthcareRun & { endingAssets: number }).endingAssets : (run as typeof housingRun & { endingFinancialAssets: number }).endingFinancialAssets;
  const success = run.success;
  const firstDepletionYear = run.firstDepletionYear ?? undefined;
  const projectionStartYear = run.projectionStartYear;
  const projectionEndYear = run.projectionEndYear;

  const flags = computeRiskFlags({
    success,
    firstDepletionYear,
    projectionEndYear,
    projectionStartYear,
    endingAssets: endingAssets ?? 0,
    yearsFunded: success ? projectionEndYear - projectionStartYear : (firstDepletionYear ?? projectionEndYear) - projectionStartYear,
    primaryAge: 60,
    hasLongevityStress: 'hasLongevityStress' in run ? run.hasLongevityStress : false,
  });

  const analysis = analyzeRisks(flags);

  return {
    success: true,
    data: { flags, analysis },
    summary: `${analysis.riskLevel} risk level with ${analysis.riskCount} risk factor(s) identified.`,
  };
}

async function fetchRecommendations(householdId: string, userId: string): Promise<ActionResult> {
  const riskResult = await fetchRiskAnalysis(householdId, userId);

  if (!riskResult.success || !riskResult.data) {
    return {
      success: false,
      error: 'Could not compute risk flags for recommendations',
      summary: 'Run a planning analysis first to get personalized recommendations.',
    };
  }

  const flags = riskResult.data.flags as ReturnType<typeof computeRiskFlags>;
  const recs = selectRecommendations(flags);

  return {
    success: true,
    data: { recommendations: recs, riskFlags: flags },
    summary: `${recs.length} adjustment option(s) identified based on current risk profile.`,
  };
}

async function fetchTaxSummary(householdId: string, _userId: string): Promise<ActionResult> {
  const run = await prisma.taxPlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  }).catch(() => null);

  if (!run) {
    return {
      success: false,
      error: 'No tax planning runs found',
      summary: 'No tax planning analysis has been run yet. Complete a tax planning analysis to see tax insights.',
    };
  }

  return {
    success: true,
    data: {
      totalFederalTax: run.totalFederalTax,
      totalStateTax: run.totalStateTax,
      totalLifetimeTax: run.totalLifetimeTax,
      success: run.success,
      firstDepletionYear: run.firstDepletionYear,
      scenarioName: run.scenario?.name,
    },
    summary: `Lifetime tax burden: $${Math.round(Number(run.totalLifetimeTax)).toLocaleString()}. Plan status: ${run.success ? 'Fully Funded' : `Depleted ${run.firstDepletionYear}`}.`,
  };
}

async function fetchHealthcareSummary(householdId: string, _userId: string): Promise<ActionResult> {
  const run = await prisma.healthcarePlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  }).catch(() => null);

  if (!run) {
    return {
      success: false,
      error: 'No healthcare planning runs found',
      summary: 'No healthcare planning analysis has been run yet.',
    };
  }

  const summaryData = run.summaryJson as unknown as Record<string, number>;

  return {
    success: true,
    data: {
      totalHealthcareCost: run.totalHealthcareCost,
      totalPreMedicareCost: summaryData?.totalPreMedicareCost ?? 0,
      totalMedicareCost: summaryData?.totalMedicareCost ?? 0,
      totalLtcCost: summaryData?.totalLtcCost ?? 0,
      success: run.success,
      hasLtcStress: run.hasLtcStress,
      hasLongevityStress: run.hasLongevityStress,
    },
    summary: `Total lifetime healthcare cost: $${Math.round(run.totalHealthcareCost).toLocaleString()}.`,
  };
}

async function fetchHousingSummary(householdId: string, _userId: string): Promise<ActionResult> {
  const run = await prisma.housingPlanningRun.findFirst({
    where: { householdId },
    orderBy: { createdAt: 'desc' },
    include: { scenario: { select: { name: true } } },
  }).catch(() => null);

  if (!run) {
    return {
      success: false,
      error: 'No housing planning runs found',
      summary: 'No housing planning analysis has been run yet.',
    };
  }

  return {
    success: true,
    data: {
      strategy: run.strategy,
      netEquityReleased: run.netReleasedEquity,
      endingAssets: run.endingFinancialAssets,
      netEstateValue: run.projectedNetEstate,
      success: run.success,
    },
    summary: `Housing strategy: ${run.strategy.replace(/_/g, ' ')}. Net equity released: $${Math.round(run.netReleasedEquity).toLocaleString()}.`,
  };
}
