/**
 * GET /api/housing-planning/[runId] — Fetch a single housing planning run
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getHousingPlanningRun } from '@/server/housing/housingPlanningService';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'No household found.' }, { status: 404 });

  try {
    const run = await getHousingPlanningRun(params.runId, householdId);
    if (!run) return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err) {
    console.error('[housing-planning/[runId] GET]', err);
    return NextResponse.json({ error: 'Failed to load housing planning run.' }, { status: 500 });
  }
}
