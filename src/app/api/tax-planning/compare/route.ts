/**
 * GET /api/tax-planning/compare?runA=<id>&runB=<id>  — Compare two tax-planning runs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTaxPlanningRun } from '@/server/tax/taxPlanningService';
import { compareTaxPlanningRuns } from '@/server/tax/taxComparisonService';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'No household found.' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const runAId = searchParams.get('runA') ?? '';
  const runBId = searchParams.get('runB') ?? '';

  if (!runAId || !runBId) {
    return NextResponse.json({ error: 'runA and runB query params required.' }, { status: 400 });
  }

  try {
    const [runA, runB] = await Promise.all([
      getTaxPlanningRun(runAId, householdId),
      getTaxPlanningRun(runBId, householdId),
    ]);
    if (!runA) return NextResponse.json({ error: `Run A not found: ${runAId}` }, { status: 404 });
    if (!runB) return NextResponse.json({ error: `Run B not found: ${runBId}` }, { status: 404 });

    const comparison = compareTaxPlanningRuns(runA, runB);
    return NextResponse.json({ comparison });
  } catch (err) {
    console.error('[tax-planning/compare GET]', err);
    return NextResponse.json({ error: 'Failed to compare runs.' }, { status: 500 });
  }
}
