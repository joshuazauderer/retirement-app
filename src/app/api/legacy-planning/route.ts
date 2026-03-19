/**
 * GET /api/legacy-planning — List housing planning runs, returning legacy projection data
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
    const runs = await listHousingPlanningRuns(householdId);
    // Return all runs sorted by projected net estate descending
    const legacyRuns = runs.sort((a, b) => b.projectedNetEstate - a.projectedNetEstate);
    return NextResponse.json({ runs: legacyRuns });
  } catch (err) {
    console.error('[legacy-planning GET]', err);
    return NextResponse.json({ error: 'Failed to load legacy planning runs.' }, { status: 500 });
  }
}
