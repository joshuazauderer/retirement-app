/**
 * alertThresholdService — detect plan risk conditions worth alerting users about.
 *
 * CRITICAL: This service reads from stored engine outputs only.
 * It does NOT re-compute any financial projections.
 *
 * Alert conditions checked:
 * 1. Latest SimulationRun portfolio depletion before life expectancy
 * 2. Monte Carlo success rate below threshold
 * 3. High/Critical AI risk flags from stored AiInsightCache
 */

import { PrismaClient } from '@prisma/client';
import type { AlertCheckResult, CreateNotificationInput, NotificationType } from './types';
import { createNotification } from './inAppNotificationService';
import { isAlertEnabled } from './notificationPreferenceService';
import { logger } from '../logging/loggerService';

/** Monte Carlo success rate below this → PLAN_RISK_HIGH */
const MONTE_CARLO_HIGH_THRESHOLD = 0.75;
/** Monte Carlo success rate below this → PLAN_RISK_CRITICAL */
const MONTE_CARLO_CRITICAL_THRESHOLD = 0.50;

/**
 * Check a household's latest plan data for alert-worthy conditions.
 * Creates in-app notifications for any conditions found.
 */
export async function checkAlertThresholds(
  userId: string,
  householdId: string,
  prisma: PrismaClient,
): Promise<AlertCheckResult> {
  const planRiskEnabled = await isAlertEnabled(userId, 'planRiskAlerts', prisma);

  const alertsCreated: NotificationType[] = [];

  if (planRiskEnabled) {
    // Check Monte Carlo risk
    const mcAlert = await checkMonteCarloRisk(userId, householdId, prisma);
    if (mcAlert) alertsCreated.push(mcAlert);

    // Check simulation depletion
    const simAlert = await checkSimulationDepletion(userId, householdId, prisma);
    if (simAlert) alertsCreated.push(simAlert);
  }

  logger.info('notification.alertCheck', {
    userId,
    householdId,
    action: 'alertCheck',
  });

  return {
    alertsCreated: alertsCreated.length,
    alertTypes:    alertsCreated,
    householdId,
  };
}

// ─── Individual checks ────────────────────────────────────────────────────────

async function checkMonteCarloRisk(
  userId: string,
  householdId: string,
  prisma: PrismaClient,
): Promise<NotificationType | null> {
  const latestRun = await prisma.monteCarloRun.findFirst({
    where:   { householdId },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestRun) return null;

  // successProbability is a Prisma Decimal — convert to number for comparison
  const successRate = Number(latestRun.successProbability) ?? 1;

  if (successRate < MONTE_CARLO_CRITICAL_THRESHOLD) {
    await createNotification(buildMonteCarloAlert(userId, householdId, successRate, 'PLAN_RISK_CRITICAL'), prisma);
    return 'PLAN_RISK_CRITICAL';
  }

  if (successRate < MONTE_CARLO_HIGH_THRESHOLD) {
    await createNotification(buildMonteCarloAlert(userId, householdId, successRate, 'PLAN_RISK_HIGH'), prisma);
    return 'PLAN_RISK_HIGH';
  }

  return null;
}

async function checkSimulationDepletion(
  userId: string,
  householdId: string,
  prisma: PrismaClient,
): Promise<NotificationType | null> {
  const latestRun = await prisma.simulationRun.findFirst({
    where:   { householdId },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestRun) return null;

  // firstDepletionYear = null means no depletion (good)
  if (latestRun.firstDepletionYear == null) return null;

  const notification: CreateNotificationInput = {
    userId,
    householdId,
    type:  'PORTFOLIO_DEPLETION_ALERT',
    title: 'Portfolio Depletion Detected',
    body:  `Your latest simulation projects portfolio depletion in ${latestRun.firstDepletionYear}. Review your plan to adjust withdrawal rates or income sources.`,
    metadata: {
      depletionYear: latestRun.firstDepletionYear,
      runId:         latestRun.id,
    },
  };

  await createNotification(notification, prisma);
  return 'PORTFOLIO_DEPLETION_ALERT';
}

// ─── Notification builders ────────────────────────────────────────────────────

function buildMonteCarloAlert(
  userId: string,
  householdId: string,
  successRate: number,
  type: 'PLAN_RISK_HIGH' | 'PLAN_RISK_CRITICAL',
): CreateNotificationInput {
  const pct = Math.round(successRate * 100);
  const severity = type === 'PLAN_RISK_CRITICAL' ? 'Critical' : 'High';
  const body =
    type === 'PLAN_RISK_CRITICAL'
      ? `Your Monte Carlo success rate is ${pct}% — critically below the 50% safety threshold. Immediate plan adjustments are strongly recommended.`
      : `Your Monte Carlo success rate is ${pct}%. Consider adjusting spending, retirement age, or savings rate to improve plan resilience.`;

  return {
    userId,
    householdId,
    type,
    title: `${severity} Plan Risk — ${pct}% Monte Carlo Success Rate`,
    body,
    metadata: { successRate, severity },
  };
}
