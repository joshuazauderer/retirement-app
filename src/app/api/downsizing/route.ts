/**
 * GET /api/downsizing — List housing planning runs with downsizing enabled
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listHousingPlanningRuns } from '@/server/housing/housingPlanningService';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'No household found.' }, { status: 404 });

  try {
    const allRuns = await listHousingPlanningRuns(householdId);
    const downsizingRuns = allRuns.filter((r) => r.hasDownsizing);
    return NextResponse.json({ runs: downsizingRuns });
  } catch (err) {
    console.error('[downsizing GET]', err);
    return NextResponse.json({ error: 'Failed to load downsizing runs.' }, { status: 500 });
  }
}
