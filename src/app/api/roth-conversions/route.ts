/**
 * GET /api/roth-conversions  — Return tax-planning runs that include Roth conversions,
 * with enough detail to populate the Roth conversions what-if page.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listTaxPlanningRuns } from '@/server/tax/taxPlanningService';

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
    const allRuns = await listTaxPlanningRuns(householdId);
    // Return all runs; client filters to Roth ones
    return NextResponse.json({ runs: allRuns });
  } catch (err) {
    console.error('[roth-conversions GET]', err);
    return NextResponse.json({ error: 'Failed to load Roth conversion data.' }, { status: 500 });
  }
}
