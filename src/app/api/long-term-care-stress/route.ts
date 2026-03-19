/**
 * GET /api/long-term-care-stress
 * Returns healthcare planning runs that have LTC stress enabled.
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
    const ltcRuns = allRuns.filter((r) => r.hasLtcStress);
    return NextResponse.json({ runs: ltcRuns });
  } catch (err) {
    console.error('[long-term-care-stress GET]', err);
    return NextResponse.json({ error: 'Failed to load LTC stress runs.' }, { status: 500 });
  }
}
