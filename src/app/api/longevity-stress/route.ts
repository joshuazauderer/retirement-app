/**
 * GET /api/longevity-stress
 * Returns healthcare planning runs that have longevity stress enabled.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listHealthcarePlanningRuns } from '@/server/healthcare/healthcarePlanningService';

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
    const allRuns = await listHealthcarePlanningRuns(householdId);
    const longevityRuns = allRuns.filter((r) => r.hasLongevityStress);
    return NextResponse.json({ runs: longevityRuns });
  } catch (err) {
    console.error('[longevity-stress GET]', err);
    return NextResponse.json({ error: 'Failed to load longevity stress runs.' }, { status: 500 });
  }
}
