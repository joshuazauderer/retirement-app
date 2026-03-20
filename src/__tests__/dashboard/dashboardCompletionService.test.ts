import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    simulationRun: { findFirst: vi.fn() },
    monteCarloRun: { findFirst: vi.fn() },
    socialSecurityRun: { findFirst: vi.fn() },
    taxPlanningRun: { findFirst: vi.fn() },
    withdrawalStrategyRun: { findFirst: vi.fn() },
  },
}));

// Mock profile completion service
vi.mock('@/server/services/profileCompletionService', () => ({
  getProfileCompletion: vi.fn(),
}));

import { getDashboardCompletion } from '@/server/dashboard/dashboardCompletionService';
import { prisma } from '@/lib/prisma';
import { getProfileCompletion } from '@/server/services/profileCompletionService';

const mockPrisma = prisma as unknown as {
  simulationRun: { findFirst: ReturnType<typeof vi.fn> };
  monteCarloRun: { findFirst: ReturnType<typeof vi.fn> };
  socialSecurityRun: { findFirst: ReturnType<typeof vi.fn> };
  taxPlanningRun: { findFirst: ReturnType<typeof vi.fn> };
  withdrawalStrategyRun: { findFirst: ReturnType<typeof vi.fn> };
};
const mockGetProfileCompletion = getProfileCompletion as ReturnType<typeof vi.fn>;

const fullProfileCompletion = {
  categories: [
    { key: 'household', name: 'Household Setup', complete: true, weight: 10, score: 10 },
    { key: 'income', name: 'Income', complete: true, weight: 20, score: 20 },
    { key: 'assets', name: 'Assets', complete: true, weight: 20, score: 20 },
    { key: 'liabilities', name: 'Liabilities', complete: true, weight: 10, score: 10 },
    { key: 'expenses', name: 'Expenses', complete: true, weight: 15, score: 15 },
    { key: 'benefits', name: 'Benefits', complete: true, weight: 10, score: 10 },
    { key: 'housing', name: 'Housing', complete: true, weight: 5, score: 5 },
    { key: 'insurance', name: 'Insurance', complete: true, weight: 5, score: 5 },
    { key: 'assumptions', name: 'Assumptions', complete: true, weight: 5, score: 5 },
  ],
  totalScore: 100,
  totalWeight: 100,
  percentage: 100,
};

const emptyProfileCompletion = {
  categories: [
    { key: 'household', name: 'Household Setup', complete: false, weight: 10, score: 0 },
    { key: 'income', name: 'Income', complete: false, weight: 20, score: 0 },
    { key: 'assets', name: 'Assets', complete: false, weight: 20, score: 0 },
    { key: 'liabilities', name: 'Liabilities', complete: false, weight: 10, score: 0 },
    { key: 'expenses', name: 'Expenses', complete: false, weight: 15, score: 0 },
    { key: 'benefits', name: 'Benefits', complete: false, weight: 10, score: 0 },
    { key: 'housing', name: 'Housing', complete: false, weight: 5, score: 0 },
    { key: 'insurance', name: 'Insurance', complete: false, weight: 5, score: 0 },
    { key: 'assumptions', name: 'Assumptions', complete: false, weight: 5, score: 0 },
  ],
  totalScore: 0,
  totalWeight: 100,
  percentage: 0,
};

describe('getDashboardCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 100% when all data is complete and all runs exist', async () => {
    mockGetProfileCompletion.mockResolvedValue(fullProfileCompletion);
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ id: 'sim-1' });
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue({ id: 'mc-1' });
    mockPrisma.socialSecurityRun.findFirst.mockResolvedValue({ id: 'ss-1' });
    mockPrisma.taxPlanningRun.findFirst.mockResolvedValue({ id: 'tax-1' });
    mockPrisma.withdrawalStrategyRun.findFirst.mockResolvedValue({ id: 'wd-1' });

    const result = await getDashboardCompletion('household-1');

    expect(result.percentage).toBe(100);
    expect(result.coreDataComplete).toBe(true);
    expect(result.hasRunSimulation).toBe(true);
    expect(result.hasMonteCarlo).toBe(true);
    expect(result.hasAnyAdvancedAnalysis).toBe(true);
  });

  it('returns 0% when no data exists and no runs', async () => {
    mockGetProfileCompletion.mockResolvedValue(emptyProfileCompletion);
    mockPrisma.simulationRun.findFirst.mockResolvedValue(null);
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue(null);
    mockPrisma.socialSecurityRun.findFirst.mockResolvedValue(null);
    mockPrisma.taxPlanningRun.findFirst.mockResolvedValue(null);
    mockPrisma.withdrawalStrategyRun.findFirst.mockResolvedValue(null);

    const result = await getDashboardCompletion('household-1');

    expect(result.percentage).toBe(0);
    expect(result.coreDataComplete).toBe(false);
    expect(result.hasRunSimulation).toBe(false);
    expect(result.hasMonteCarlo).toBe(false);
    expect(result.hasAnyAdvancedAnalysis).toBe(false);
  });

  it('returns coreDataComplete: false when profile percentage is below 60', async () => {
    mockGetProfileCompletion.mockResolvedValue({ ...emptyProfileCompletion, percentage: 40 });
    mockPrisma.simulationRun.findFirst.mockResolvedValue(null);
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue(null);
    mockPrisma.socialSecurityRun.findFirst.mockResolvedValue(null);
    mockPrisma.taxPlanningRun.findFirst.mockResolvedValue(null);
    mockPrisma.withdrawalStrategyRun.findFirst.mockResolvedValue(null);

    const result = await getDashboardCompletion('household-1');

    expect(result.coreDataComplete).toBe(false);
  });

  it('returns coreDataComplete: true when profile percentage is 60 or above', async () => {
    mockGetProfileCompletion.mockResolvedValue({ ...fullProfileCompletion, percentage: 65 });
    mockPrisma.simulationRun.findFirst.mockResolvedValue(null);
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue(null);
    mockPrisma.socialSecurityRun.findFirst.mockResolvedValue(null);
    mockPrisma.taxPlanningRun.findFirst.mockResolvedValue(null);
    mockPrisma.withdrawalStrategyRun.findFirst.mockResolvedValue(null);

    const result = await getDashboardCompletion('household-1');

    expect(result.coreDataComplete).toBe(true);
  });

  it('hasRunSimulation matches presence of simulationRun', async () => {
    mockGetProfileCompletion.mockResolvedValue(fullProfileCompletion);
    mockPrisma.simulationRun.findFirst.mockResolvedValue({ id: 'sim-1' });
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue(null);
    mockPrisma.socialSecurityRun.findFirst.mockResolvedValue(null);
    mockPrisma.taxPlanningRun.findFirst.mockResolvedValue(null);
    mockPrisma.withdrawalStrategyRun.findFirst.mockResolvedValue(null);

    const result = await getDashboardCompletion('household-1');

    expect(result.hasRunSimulation).toBe(true);
    expect(result.hasMonteCarlo).toBe(false);
  });

  it('simulation item has attention status when data is complete but no sim run', async () => {
    mockGetProfileCompletion.mockResolvedValue({ ...fullProfileCompletion, percentage: 80 });
    mockPrisma.simulationRun.findFirst.mockResolvedValue(null);
    mockPrisma.monteCarloRun.findFirst.mockResolvedValue(null);
    mockPrisma.socialSecurityRun.findFirst.mockResolvedValue(null);
    mockPrisma.taxPlanningRun.findFirst.mockResolvedValue(null);
    mockPrisma.withdrawalStrategyRun.findFirst.mockResolvedValue(null);

    const result = await getDashboardCompletion('household-1');

    const simItem = result.items.find(i => i.key === 'simulation');
    expect(simItem?.status).toBe('attention');
  });
});
