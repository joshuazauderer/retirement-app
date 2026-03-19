/**
 * metricsService — observability hooks for timing, errors, and usage.
 *
 * Design: OpenTelemetry-compatible structure for future integration.
 * In v1: structured logging-based metrics (no external service required).
 *
 * Usage:
 *   const timer = startTimer();
 *   // ... operation ...
 *   recordOperationTiming('simulation.run', timer.elapsed(), { householdId });
 */

import { logger } from '../logging/loggerService';

export interface OperationTimer {
  startMs: number;
  elapsed: () => number;
}

/**
 * Start a timer for measuring operation duration.
 */
export function startTimer(): OperationTimer {
  const startMs = Date.now();
  return {
    startMs,
    elapsed: () => Date.now() - startMs,
  };
}

/**
 * Record timing for a named operation.
 */
export function recordOperationTiming(
  operationName: string,
  durationMs: number,
  context?: Record<string, string | number | boolean | undefined>,
): void {
  logger.info(`operation.timing`, {
    action: operationName,
    durationMs,
    ...context,
  });
}

/**
 * Record an error event for monitoring.
 */
export function recordError(
  operationName: string,
  error: Error,
  context?: Record<string, string | number | boolean | undefined>,
): void {
  logger.error(`operation.error`, { action: operationName, ...context }, error);
}

/**
 * Record an AI API call (timing + provider info).
 */
export function recordAiCall(params: {
  provider: string;
  model: string;
  insightType: string;
  durationMs: number;
  fromCache: boolean;
  fromFallback: boolean;
  userId?: string;
}): void {
  logger.info('ai.call', {
    action: 'ai.insight',
    provider: params.provider,
    model: params.model,
    insightType: params.insightType,
    durationMs: params.durationMs,
    fromCache: params.fromCache,
    fromFallback: params.fromFallback,
    userId: params.userId,
  });
}

/**
 * Record a simulation run.
 */
export function recordSimulationRun(params: {
  simulationType: string;
  durationMs: number;
  success: boolean;
  householdId: string;
  userId?: string;
}): void {
  logger.info('simulation.run', {
    action: 'simulation',
    simulationType: params.simulationType,
    durationMs: params.durationMs,
    success: params.success,
    householdId: params.householdId,
    userId: params.userId,
  });
}

/**
 * Record a report export action.
 */
export function recordReportExport(params: {
  reportType: string;
  format: string;
  householdId: string;
  userId?: string;
}): void {
  logger.info('report.export', {
    action: 'report.export',
    reportType: params.reportType,
    format: params.format,
    householdId: params.householdId,
    userId: params.userId,
  });
}

/**
 * Record a collaboration action (invite sent, accepted, etc.)
 */
export function recordCollaborationEvent(params: {
  action: string;
  householdId: string;
  actorUserId: string;
  role?: string;
}): void {
  logger.info('collaboration.event', {
    action: params.action,
    householdId: params.householdId,
    userId: params.actorUserId,
    role: params.role,
  });
}
