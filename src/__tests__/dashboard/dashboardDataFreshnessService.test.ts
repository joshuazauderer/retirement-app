import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    incomeSource: { findFirst: vi.fn() },
    assetAccount: { findFirst: vi.fn() },
    liability: { findFirst: vi.fn() },
    expenseProfile: { findUnique: vi.fn() },
    benefitSource: { findFirst: vi.fn() },
    planningAssumptions: { findUnique: vi.fn() },
  },
}));

import { getDashboardDataFreshness } from '@/server/dashboard/dashboardDataFreshnessService';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  incomeSource: { findFirst: ReturnType<typeof vi.fn> };
  assetAccount: { findFirst: ReturnType<typeof vi.fn> };
  liability: { findFirst: ReturnType<typeof vi.fn> };
  expenseProfile: { findUnique: ReturnType<typeof vi.fn> };
  benefitSource: { findFirst: ReturnType<typeof vi.fn> };
  planningAssumptions: { findUnique: ReturnType<typeof vi.fn> };
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe('getDashboardDataFreshness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.incomeSource.findFirst.mockResolvedValue(null);
    mockPrisma.assetAccount.findFirst.mockResolvedValue(null);
    mockPrisma.liability.findFirst.mockResolvedValue(null);
    mockPrisma.expenseProfile.findUnique.mockResolvedValue(null);
    mockPrisma.benefitSource.findFirst.mockResolvedValue(null);
    mockPrisma.planningAssumptions.findUnique.mockResolvedValue(null);
  });

  it('returns lastUpdated: null for items with no data', async () => {
    const result = await getDashboardDataFreshness('household-1');

    result.items.forEach(item => {
      expect(item.lastUpdated).toBeNull();
      expect(item.daysSinceUpdate).toBeNull();
      expect(item.isStale).toBe(false);
    });

    expect(result.lastUpdated).toBeNull();
    expect(result.daysSinceLastUpdate).toBeNull();
  });

  it('returns isStale: false for items updated today', async () => {
    const today = new Date();
    mockPrisma.incomeSource.findFirst.mockResolvedValue({ updatedAt: today });

    const result = await getDashboardDataFreshness('household-1');

    const incomeItem = result.items.find(i => i.key === 'income')!;
    expect(incomeItem.isStale).toBe(false);
    expect(incomeItem.daysSinceUpdate).toBe(0);
  });

  it('returns isStale: true for items updated 100 days ago', async () => {
    const oldDate = daysAgo(100);
    mockPrisma.incomeSource.findFirst.mockResolvedValue({ updatedAt: oldDate });
    mockPrisma.assetAccount.findFirst.mockResolvedValue({ updatedAt: oldDate });

    const result = await getDashboardDataFreshness('household-1');

    const incomeItem = result.items.find(i => i.key === 'income')!;
    expect(incomeItem.isStale).toBe(true);
    expect(incomeItem.daysSinceUpdate).toBeGreaterThanOrEqual(100);
  });

  it('suggestedUpdates lists stale item labels', async () => {
    const oldDate = daysAgo(100);
    mockPrisma.incomeSource.findFirst.mockResolvedValue({ updatedAt: oldDate });
    mockPrisma.assetAccount.findFirst.mockResolvedValue({ updatedAt: oldDate });

    const result = await getDashboardDataFreshness('household-1');

    expect(result.suggestedUpdates).toContain('Income');
    expect(result.suggestedUpdates).toContain('Asset Balances');
  });

  it('overallIsStale is false when data is fresh', async () => {
    const recentDate = daysAgo(5);
    mockPrisma.incomeSource.findFirst.mockResolvedValue({ updatedAt: recentDate });

    const result = await getDashboardDataFreshness('household-1');

    expect(result.overallIsStale).toBe(false);
    expect(result.suggestedUpdates).toHaveLength(0);
  });

  it('lastUpdated reflects the most recently updated item', async () => {
    const olderDate = daysAgo(30);
    const newerDate = daysAgo(5);
    mockPrisma.incomeSource.findFirst.mockResolvedValue({ updatedAt: olderDate });
    mockPrisma.assetAccount.findFirst.mockResolvedValue({ updatedAt: newerDate });

    const result = await getDashboardDataFreshness('household-1');

    expect(result.daysSinceLastUpdate).toBeLessThanOrEqual(6);
    expect(result.daysSinceLastUpdate).toBeGreaterThanOrEqual(4);
  });

  it('items not updated are excluded from stale calculation', async () => {
    const oldDate = daysAgo(100);
    mockPrisma.incomeSource.findFirst.mockResolvedValue({ updatedAt: oldDate });

    const result = await getDashboardDataFreshness('household-1');

    expect(result.overallIsStale).toBe(true);
    expect(result.suggestedUpdates).toContain('Income');
    expect(result.suggestedUpdates).not.toContain('Asset Balances');
  });
});
