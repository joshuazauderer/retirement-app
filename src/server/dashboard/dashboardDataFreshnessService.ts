import { prisma } from '@/lib/prisma';
import type { DataFreshnessSummary, DataFreshnessItem } from './types';

const STALE_THRESHOLD_DAYS = 90;

export async function getDashboardDataFreshness(householdId: string): Promise<DataFreshnessSummary> {
  const [
    latestIncome,
    latestAsset,
    latestLiability,
    expenses,
    latestBenefit,
    assumptions,
  ] = await Promise.all([
    prisma.incomeSource.findFirst({
      where: { householdId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.assetAccount.findFirst({
      where: { householdId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.liability.findFirst({
      where: { householdId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.expenseProfile.findUnique({
      where: { householdId },
      select: { updatedAt: true },
    }),
    prisma.benefitSource.findFirst({
      where: { householdId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.planningAssumptions.findUnique({
      where: { householdId },
      select: { updatedAt: true },
    }),
  ]);

  const now = new Date();

  function buildItem(label: string, key: string, href: string, date: Date | null | undefined): DataFreshnessItem {
    if (!date) {
      return { label, key, lastUpdated: null, daysSinceUpdate: null, isStale: false, href };
    }
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return {
      label,
      key,
      lastUpdated: date.toISOString(),
      daysSinceUpdate: days,
      isStale: days > STALE_THRESHOLD_DAYS,
      href,
    };
  }

  const items: DataFreshnessItem[] = [
    buildItem('Income', 'income', '/app/income', latestIncome?.updatedAt),
    buildItem('Asset Balances', 'assets', '/app/assets', latestAsset?.updatedAt),
    buildItem('Liabilities', 'liabilities', '/app/liabilities', latestLiability?.updatedAt),
    buildItem('Expenses', 'expenses', '/app/expenses', expenses?.updatedAt),
    buildItem('Benefits', 'benefits', '/app/benefits', latestBenefit?.updatedAt),
    buildItem('Assumptions', 'assumptions', '/app/assumptions', assumptions?.updatedAt),
  ];

  const itemsWithDates = items.filter(i => i.lastUpdated !== null);
  const staleItems = items.filter(i => i.isStale);

  // Overall freshness = most recent update across all items
  const mostRecent = itemsWithDates.length > 0
    ? itemsWithDates.reduce((latest, item) =>
        new Date(item.lastUpdated!) > new Date(latest.lastUpdated!) ? item : latest
      )
    : null;

  const daysSinceLastUpdate = mostRecent?.daysSinceUpdate ?? null;
  const overallIsStale = staleItems.length > 0 && daysSinceLastUpdate !== null && daysSinceLastUpdate > STALE_THRESHOLD_DAYS;

  const suggestedUpdates = staleItems.map(i => i.label);

  return {
    lastUpdated: mostRecent?.lastUpdated ?? null,
    daysSinceLastUpdate,
    overallIsStale,
    items,
    suggestedUpdates,
  };
}
