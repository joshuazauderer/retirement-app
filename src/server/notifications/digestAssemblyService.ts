/**
 * digestAssemblyService — assemble a weekly/monthly digest from existing planning data.
 *
 * CRITICAL: No re-computation. All data is read from stored DB records only.
 * The digest summarises what's already been calculated by the planning engines.
 */

import { PrismaClient } from '@prisma/client';
import type { DigestContent, DigestSection } from './types';
import { getAppBaseUrl } from './emailSendService';

/**
 * Assemble a digest for a household.
 * Returns null if there is insufficient data to build a meaningful digest.
 */
export async function assembleDigest(params: {
  userId:       string;
  householdId:  string;
  userEmail:    string;
  userFirstName: string;
  frequency:    'WEEKLY' | 'MONTHLY';
  prisma:       PrismaClient;
}): Promise<DigestContent | null> {
  const { userId, householdId, userEmail: _userEmail, userFirstName, frequency, prisma } = params;
  void userId;

  // Load all planning data for the household in parallel
  const [
    household,
    latestSimulation,
    latestMonteCarlo,
    latestTaxRun,
    latestHealthcareRun,
    latestHousingRun,
  ] = await Promise.all([
    prisma.household.findUnique({
      where:   { id: householdId },
      include: { members: true },
    }),
    prisma.simulationRun.findFirst({
      where:   { householdId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.monteCarloRun.findFirst({
      where:   { householdId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.taxPlanningRun.findFirst({
      where:   { householdId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.healthcarePlanningRun.findFirst({
      where:   { householdId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.housingPlanningRun.findFirst({
      where:   { householdId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!household) return null;

  const householdName = household.name;
  const periodLabel   = frequency === 'WEEKLY' ? 'Weekly Digest' : 'Monthly Digest';
  const baseUrl       = getAppBaseUrl();

  // ── Sections ────────────────────────────────────────────────────────────────

  const sections: DigestSection[] = [];

  // Plan Health section
  const planHealthItems: string[] = [];

  if (latestSimulation) {
    const depletionYear = latestSimulation.firstDepletionYear;
    if (depletionYear) {
      planHealthItems.push(
        `Portfolio projected to deplete in ${depletionYear}. Review withdrawal rate and income sources.`,
      );
    } else {
      planHealthItems.push('Portfolio projects no depletion through retirement — plan appears on track.');
    }
  }

  if (latestMonteCarlo) {
    const pct = Math.round((Number(latestMonteCarlo.successProbability) ?? 0) * 100);
    planHealthItems.push(`Monte Carlo success rate: ${pct}% across ${latestMonteCarlo.simulationCount} scenarios.`);
  }

  if (planHealthItems.length > 0) {
    sections.push({ heading: 'Plan Health', items: planHealthItems });
  }

  // Tax Planning section
  if (latestTaxRun) {
    const summary = latestTaxRun.summaryJson as Record<string, unknown> | null;
    const taxItems: string[] = [];

    if (summary?.totalTaxLiability != null) {
      taxItems.push(`Estimated total tax liability: ${formatCurrency(summary.totalTaxLiability as number)}`);
    }
    if (summary?.rothConversionOpportunities != null) {
      taxItems.push(`Roth conversion opportunities identified: ${summary.rothConversionOpportunities}`);
    }
    if (taxItems.length > 0) {
      sections.push({ heading: 'Tax Planning', items: taxItems });
    }
  }

  // Healthcare section
  if (latestHealthcareRun) {
    const totalCost = latestHealthcareRun.totalHealthcareCost;
    const healthItems: string[] = [
      `Projected total healthcare cost: ${formatCurrency(totalCost)}`,
    ];
    if (latestHealthcareRun.hasLtcStress) {
      healthItems.push('Long-term care stress scenario is included in your healthcare projection.');
    }
    if (latestHealthcareRun.hasLongevityStress) {
      healthItems.push(`Longevity stress target age: ${latestHealthcareRun.longevityTargetAge ?? 'extended'}.`);
    }
    sections.push({ heading: 'Healthcare Planning', items: healthItems });
  }

  // Housing section
  if (latestHousingRun) {
    const housingItems: string[] = [
      `Housing strategy: ${formatHousingStrategy(latestHousingRun.strategy)}`,
    ];
    if (latestHousingRun.netReleasedEquity && latestHousingRun.netReleasedEquity > 0) {
      housingItems.push(`Net equity released: ${formatCurrency(latestHousingRun.netReleasedEquity)}`);
    }
    if (latestHousingRun.projectedNetEstate != null) {
      housingItems.push(`Projected net estate value: ${formatCurrency(latestHousingRun.projectedNetEstate)}`);
    }
    sections.push({ heading: 'Housing & Legacy', items: housingItems });
  }

  // ── Plan health summary line ────────────────────────────────────────────────

  let planHealthSummary = 'Your retirement plan is up to date.';

  if (latestMonteCarlo) {
    const pct = Math.round((Number(latestMonteCarlo.successProbability) ?? 0) * 100);
    if (pct >= 85) {
      planHealthSummary = `Your plan is in strong shape with a ${pct}% Monte Carlo success rate.`;
    } else if (pct >= 70) {
      planHealthSummary = `Your plan shows a ${pct}% success rate. Some adjustments may improve resilience.`;
    } else {
      planHealthSummary = `Your plan has a ${pct}% success rate — consider reviewing your strategy soon.`;
    }
  } else if (latestSimulation) {
    planHealthSummary = latestSimulation.firstDepletionYear
      ? `Simulation detected portfolio depletion in ${latestSimulation.firstDepletionYear}. Review your plan.`
      : 'Latest simulation shows no portfolio depletion — plan looks healthy.';
  }

  return {
    householdName,
    userFirstName,
    periodLabel,
    sections,
    planHealthSummary,
    callToActionUrl: `${baseUrl}/app/overview`,
    unsubscribeUrl:  `${baseUrl}/app/settings/notifications`,
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHousingStrategy(strategy: string): string {
  const labels: Record<string, string> = {
    STAY_IN_PLACE:          'Stay in Place',
    DOWNSIZE:               'Downsize',
    RELOCATE:               'Relocate',
    DOWNSIZE_AND_RELOCATE:  'Downsize & Relocate',
  };
  return labels[strategy] ?? strategy;
}
