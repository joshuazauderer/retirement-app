/**
 * POST /api/notifications/jobs — trigger notification background jobs.
 *
 * This endpoint is intended for internal/admin use.
 * In production: called by Coolify scheduled tasks or a cron service.
 *
 * Body: { job: 'alertCheck' | 'weeklyDigest' | 'monthlyDigest' | 'purge' }
 *
 * Security: requires NOTIFICATION_JOB_SECRET header to match env var,
 * OR authenticated user with an active session (for manual triggering from admin UI).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  enqueueAlertCheck,
  enqueueWeeklyDigest,
  enqueueMonthlyDigest,
  enqueuePurgeOldNotifications,
} from '@/server/jobs/notificationJobs';
import { handleApiError } from '@/server/errors/errorHandlerService';
import { requireAuth }    from '@/server/security/authGuard';

const VALID_JOBS = ['alertCheck', 'weeklyDigest', 'monthlyDigest', 'purge'] as const;
type JobName = (typeof VALID_JOBS)[number];

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Accept either a shared secret header (for cron) or an authenticated user session
    const jobSecret = process.env.NOTIFICATION_JOB_SECRET;
    const headerSecret = req.headers.get('x-notification-job-secret');

    let authorized = false;

    if (jobSecret && headerSecret === jobSecret) {
      authorized = true;
    } else {
      const [, authError] = await requireAuth();
      authorized = !authError;
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as { job?: string };
    const jobName = body.job as JobName;

    if (!VALID_JOBS.includes(jobName)) {
      return NextResponse.json(
        { error: `Invalid job. Must be one of: ${VALID_JOBS.join(', ')}` },
        { status: 400 },
      );
    }

    let jobId: string;
    switch (jobName) {
      case 'alertCheck':    jobId = enqueueAlertCheck();              break;
      case 'weeklyDigest':  jobId = enqueueWeeklyDigest();            break;
      case 'monthlyDigest': jobId = enqueueMonthlyDigest();           break;
      case 'purge':         jobId = enqueuePurgeOldNotifications();   break;
    }

    return NextResponse.json({ jobId, job: jobName, status: 'QUEUED' });
  } catch (err) {
    return handleApiError(err);
  }
}
