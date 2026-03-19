/**
 * GET /api/tax-planning/[runId]  — Get a single tax-planning run
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTaxPlanningRun } from '@/server/tax/taxPlanningService';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'No household found.' }, { status: 404 });

  try {
    const run = await getTaxPlanningRun(params.runId, householdId);
    if (!run) return NextResponse.json({ error: 'Tax-planning run not found.' }, { status: 404 });
    return NextResponse.json({ run });
  } catch (err) {
    console.error('[tax-planning/[runId] GET]', err);
    return NextResponse.json({ error: 'Failed to load run.' }, { status: 500 });
  }
}
