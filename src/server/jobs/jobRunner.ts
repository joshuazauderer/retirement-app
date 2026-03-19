/**
 * jobRunner — lightweight async job execution foundation.
 *
 * v1 Design: fire-and-forget async jobs with logging.
 * Future: replace with proper queue (BullMQ, etc.) when scaling.
 *
 * Use cases:
 * - Heavy simulations that should not block the request
 * - AI precomputation in background
 * - Report generation async
 * - Cache warming
 *
 * Jobs are tracked in memory during their lifetime.
 * Failed jobs are logged but do not retry automatically in v1.
 */

import { logger } from '../logging/loggerService';
import { startTimer, recordOperationTiming, recordError } from '../observability/metricsService';

export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface Job<T = unknown> {
  id: string;
  name: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: T;
}

export type JobFn<T> = () => Promise<T>;

// In-memory job tracker (for the lifetime of the process)
const jobs = new Map<string, Job>();

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Queue and execute a job asynchronously.
 * Returns the job ID immediately — caller can poll status if needed.
 */
export function enqueueJob<T>(name: string, fn: JobFn<T>): string {
  const id = generateJobId();
  const job: Job<T> = {
    id,
    name,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  };

  jobs.set(id, job);

  logger.info('job.queued', { action: name, requestId: id });

  // Execute asynchronously without blocking
  setImmediate(async () => {
    job.status = 'RUNNING';
    job.startedAt = new Date().toISOString();

    const timer = startTimer();
    try {
      const result = await fn();
      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();
      job.result = result;

      recordOperationTiming(`job.${name}`, timer.elapsed(), { requestId: id });
      logger.info('job.completed', { action: name, requestId: id, durationMs: timer.elapsed() });
    } catch (err) {
      job.status = 'FAILED';
      job.completedAt = new Date().toISOString();
      job.error = err instanceof Error ? err.message : 'Unknown error';

      recordError(`job.${name}`, err instanceof Error ? err : new Error(String(err)), { requestId: id });
      logger.error('job.failed', { action: name, requestId: id }, err instanceof Error ? err : undefined);
    }

    // Clean up completed jobs after 1 hour
    setTimeout(() => jobs.delete(id), 60 * 60 * 1000);
  });

  return id;
}

/**
 * Get job status by ID.
 */
export function getJobStatus(id: string): Job | null {
  return jobs.get(id) ?? null;
}

/**
 * List active jobs (running or queued).
 */
export function listActiveJobs(): Job[] {
  return Array.from(jobs.values()).filter((j) => j.status === 'QUEUED' || j.status === 'RUNNING');
}
