/**
 * GET /api/survivor-income?runId=<id>
 * Returns survivor income analysis from a Social Security run.
 *
 * This endpoint surfaces the survivorTransition from an existing SS run,
 * along with computed income adequacy metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSocialSecurityRun } from '@/server/socialSecurity/socialSecurityService';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) {
    return NextResponse.json({ error: 'No household found.' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('runId');

  if (!runId) {
    return NextResponse.json({ error: 'runId query param is required.' }, { status: 400 });
  }

  try {
    const run = await getSocialSecurityRun(runId, householdId);
    if (!run) {
      return NextResponse.json({ error: 'SS run not found.' }, { status: 404 });
    }
    if (!run.survivorTransition) {
      return NextResponse.json({
        error: 'This SS run has no survivor transition data (single-member household).',
      }, { status: 400 });
    }

    return NextResponse.json({
      survivorTransition: run.survivorTransition,
      coupleCoordination: run.coupleCoordination,
      memberSummaries: run.memberSummaries,
      runId: run.runId,
      label: run.label,
    });
  } catch (err) {
    console.error('[survivor-income GET]', err);
    return NextResponse.json({ error: 'Failed to load survivor income data.' }, { status: 500 });
  }
}
