import { prisma } from '@/lib/prisma';
import type { ReviewCadenceSummary } from './types';

export async function getDashboardReviewCadence(
  userId: string,
  householdId: string,
): Promise<ReviewCadenceSummary> {
  const [preference, latestSim, latestMC] = await Promise.all([
    prisma.notificationPreference.findUnique({
      where: { userId },
      select: { digestFrequency: true },
    }),
    prisma.simulationRun.findFirst({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.monteCarloRun.findFirst({
      where: { householdId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const cadence = preference?.digestFrequency ?? 'MONTHLY';
  const hasReviewSchedule = cadence !== 'NEVER';

  // Last meaningful activity = most recent run
  const activities = [latestSim?.createdAt, latestMC?.createdAt].filter(Boolean) as Date[];
  const lastActivity = activities.length > 0
    ? activities.reduce((a, b) => a > b ? a : b)
    : null;

  // Compute next review date based on cadence
  let nextReviewDate: string | null = null;
  let isOverdue = false;

  if (lastActivity && hasReviewSchedule) {
    const next = new Date(lastActivity);
    if (cadence === 'WEEKLY') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    nextReviewDate = next.toISOString();
    isOverdue = next < new Date();
  } else if (!lastActivity && hasReviewSchedule) {
    // Never reviewed — overdue immediately
    isOverdue = true;
  }

  const cadenceLabel = cadence === 'WEEKLY'
    ? 'Weekly'
    : cadence === 'MONTHLY'
    ? 'Monthly'
    : 'Not scheduled';

  return {
    hasReviewSchedule,
    nextReviewDate,
    isOverdue,
    cadenceLabel,
    lastActivityDate: lastActivity?.toISOString() ?? null,
  };
}
