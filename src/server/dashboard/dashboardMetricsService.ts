import { prisma } from '@/lib/prisma';
import type { DashboardMetricCard } from './types';

export async function getDashboardMetrics(householdId: string): Promise<DashboardMetricCard[]> {
  const [latestSim, latestMC, member, assumptions] = await Promise.all([
    prisma.simulationRun.findFirst({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      select: {
        endingBalance: true,
        firstDepletionYear: true,
        projectionEndYear: true,
        projectionStartYear: true,
        success: true,
      },
    }),
    prisma.monteCarloRun.findFirst({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      select: { successProbability: true },
    }),
    prisma.householdMember.findFirst({
      where: { householdId, relationshipType: 'PRIMARY' },
      select: { retirementTargetAge: true, dateOfBirth: true },
    }),
    prisma.planningAssumptions.findUnique({
      where: { householdId },
      select: { expectedPortfolioReturn: true },
    }),
  ]);

  const metrics: DashboardMetricCard[] = [];

  // Retirement Age
  if (member?.retirementTargetAge) {
    metrics.push({
      label: 'Target Retirement Age',
      value: `${member.retirementTargetAge}`,
      subtext: member.dateOfBirth
        ? `In ${member.retirementTargetAge - (new Date().getFullYear() - new Date(member.dateOfBirth).getFullYear())} years`
        : undefined,
      available: true,
      href: '/app/assumptions',
    });
  } else {
    metrics.push({ label: 'Target Retirement Age', value: 'Not set', available: false, href: '/app/assumptions' });
  }

  // Years Funded
  if (latestSim) {
    const yearsFunded = latestSim.firstDepletionYear
      ? latestSim.firstDepletionYear - latestSim.projectionStartYear
      : latestSim.projectionEndYear - latestSim.projectionStartYear;
    metrics.push({
      label: 'Years Funded',
      value: `${yearsFunded} yrs`,
      subtext: latestSim.firstDepletionYear ? 'Until depletion' : 'Through plan end',
      available: true,
      href: '/app/simulations',
    });
  } else {
    metrics.push({ label: 'Years Funded', value: 'Not calculated', available: false, href: '/app/simulations' });
  }

  // Projected Ending Balance
  if (latestSim) {
    const bal = Number(latestSim.endingBalance);
    metrics.push({
      label: 'Projected Ending Balance',
      value: fmtCurrency(bal),
      subtext: latestSim.success ? 'Plan fully funded' : 'Plan runs short',
      available: true,
      href: '/app/simulations',
    });
  } else {
    metrics.push({ label: 'Projected Ending Balance', value: 'Not calculated', available: false, href: '/app/simulations' });
  }

  // Monte Carlo Success Rate
  if (latestMC) {
    const pct = Math.round(Number(latestMC.successProbability) * 100);
    metrics.push({
      label: 'Monte Carlo Success Rate',
      value: `${pct}%`,
      subtext: pct >= 80 ? 'Strong confidence' : pct >= 60 ? 'Moderate confidence' : 'Low confidence',
      available: true,
      href: '/app/monte-carlo',
    });
  } else {
    metrics.push({ label: 'Monte Carlo Success Rate', value: 'Not run yet', available: false, href: '/app/monte-carlo' });
  }

  // Expected Portfolio Return (from assumptions)
  if (assumptions?.expectedPortfolioReturn) {
    const rate = Number(assumptions.expectedPortfolioReturn);
    // Rate stored as decimal (0.07 = 7%) — clamp > 1 to /100 defensively
    const pct = rate > 1 ? rate.toFixed(1) : (rate * 100).toFixed(1);
    metrics.push({
      label: 'Expected Return Rate',
      value: `${pct}%`,
      subtext: rate > 1 ? 'Per year (assumed)' : `${pct}% per year (assumed)`.replace(/^\d+\.?\d*% /, ''),
      available: true,
      href: '/app/assumptions',
    });
  } else {
    metrics.push({ label: 'Expected Return Rate', value: 'Not configured', available: false, href: '/app/assumptions' });
  }

  return metrics;
}

function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
