import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { compareWithdrawalStrategyRuns } from '@/server/withdrawalStrategies/withdrawalStrategyComparisonService';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'Household not found.' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const a = searchParams.get('a');
  const b = searchParams.get('b');

  if (!a || !b) {
    return NextResponse.json({ error: 'Query params ?a=runId&b=runId are required.' }, { status: 400 });
  }
  if (a === b) {
    return NextResponse.json({ error: 'Cannot compare a run with itself.' }, { status: 400 });
  }

  try {
    const comparison = await compareWithdrawalStrategyRuns(a, b, householdId);
    return NextResponse.json({ comparison });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Comparison failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
