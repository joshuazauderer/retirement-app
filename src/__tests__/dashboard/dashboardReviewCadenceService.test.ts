import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationPreference: { findUnique: vi.fn() },
    simulationRun: { findFirst: vi.fn() },
    monteCarloRun: { findFirst: vi.fn() },
  },
}));

import { getDashboardReviewCadence } from '@/server/dashboard/dashboardReviewCadenceService';
import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  notificationPreference: { findUnique: ReturnType<typeof vi.fn> };
  simulationRun: { findFirst: ReturnType<typeof vi.fn> };
  monteCarloRun: { findFirst: ReturnType<typeof vi.fn> };
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe('getDashboardReviewCadence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.simulationRun.findFirst.mockResolvedValue(null);
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue(null);
  });

  it('WEEKLY cadence with run 10 days ago → isOverdue: true', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ digestFrequency: 'WEEKLY' });
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ createdAt: daysAgo(10) });

    const result = await getDashboardReviewCadence('user-1', 'household-1');

    expect(result.isOverdue).toBe(true);
    expect(result.cadenceLabel).toBe('Weekly');
    expect(result.hasReviewSchedule).toBe(true);
  });

  it('MONTHLY cadence with run 20 days ago → isOverdue: false', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ digestFrequency: 'MONTHLY' });
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ createdAt: daysAgo(20) });

    const result = await getDashboardReviewCadence('user-1', 'household-1');

    expect(result.isOverdue).toBe(false);
    expect(result.cadenceLabel).toBe('Monthly');
    expect(result.hasReviewSchedule).toBe(true);
  });

  it('no runs → isOverdue: true when hasReviewSchedule is true', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ digestFrequency: 'MONTHLY' });

    const result = await getDashboardReviewCadence('user-1', 'household-1');

    expect(result.isOverdue).toBe(true);
    expect(result.hasReviewSchedule).toBe(true);
    expect(result.lastActivityDate).toBeNull();
  });

  it('NEVER cadence → hasReviewSchedule: false', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ digestFrequency: 'NEVER' });
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ createdAt: daysAgo(5) });

    const result = await getDashboardReviewCadence('user-1', 'household-1');

    expect(result.hasReviewSchedule).toBe(false);
    expect(result.cadenceLabel).toBe('Not scheduled');
    expect(result.isOverdue).toBe(false);
  });

  it('uses most recent activity from either simulation or Monte Carlo', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ digestFrequency: 'MONTHLY' });
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ createdAt: daysAgo(45) });
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue({ createdAt: daysAgo(10) });

    const result = await getDashboardReviewCadence('user-1', 'household-1');

    // Most recent is 10 days ago; monthly threshold is 30 days; not overdue
    expect(result.isOverdue).toBe(false);
    expect(result.lastActivityDate).not.toBeNull();
  });

  it('falls back to MONTHLY when no preference found', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ createdAt: daysAgo(20) });

    const result = await getDashboardReviewCadence('user-1', 'household-1');

    expect(result.cadenceLabel).toBe('Monthly');
    expect(result.isOverdue).toBe(false);
  });

  it('WEEKLY cadence with run 5 days ago → isOverdue: false', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ digestFrequency: 'WEEKLY' });
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ createdAt: daysAgo(5) });

    const result = await getDashboardReviewCadence('user-1', 'household-1');

    expect(result.isOverdue).toBe(false);
  });
});
