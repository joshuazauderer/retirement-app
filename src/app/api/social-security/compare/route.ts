/**
 * GET /api/social-security/compare?runA=<id>&runB=<id>
 * Compare two Social Security planning runs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSocialSecurityRun } from '@/server/socialSecurity/socialSecurityService';
import { compareSocialSecurityRuns } from '@/server/socialSecurity/socialSecurityComparisonService';

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
  const runAId = searchParams.get('runA');
  const runBId = searchParams.get('runB');

  if (!runAId || !runBId) {
    return NextResponse.json({ error: 'runA and runB query params are required.' }, { status: 400 });
  }

  try {
    const [runA, runB] = await Promise.all([
      getSocialSecurityRun(runAId, householdId),
      getSocialSecurityRun(runBId, householdId),
    ]);

    if (!runA) return NextResponse.json({ error: `SS run ${runAId} not found.` }, { status: 404 });
    if (!runB) return NextResponse.json({ error: `SS run ${runBId} not found.` }, { status: 404 });

    const comparison = compareSocialSecurityRuns(runA, runB);
    return NextResponse.json({ comparison });
  } catch (err) {
    console.error('[social-security/compare GET]', err);
    return NextResponse.json({ error: 'Failed to compare SS runs.' }, { status: 500 });
  }
}
