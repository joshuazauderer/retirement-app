import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getWithdrawalStrategyRun } from '@/server/withdrawalStrategies/withdrawalStrategyService';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'Household not found.' }, { status: 404 });

  const run = await getWithdrawalStrategyRun(params.runId, householdId);
  if (!run) return NextResponse.json({ error: 'Run not found.' }, { status: 404 });

  return NextResponse.json({ run });
}
