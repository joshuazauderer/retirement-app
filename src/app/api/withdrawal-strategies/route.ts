import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runWithdrawalStrategy, listWithdrawalStrategyRuns, validateWithdrawalStrategyInput } from '@/server/withdrawalStrategies/withdrawalStrategyService';
import type { WithdrawalStrategyRunInput } from '@/server/withdrawalStrategies/types';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ runs: [] });

  const runs = await listWithdrawalStrategyRuns(householdId, false);
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'Household not found.' }, { status: 404 });

  let body: Partial<WithdrawalStrategyRunInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const input: WithdrawalStrategyRunInput = {
    householdId,
    scenarioId: body.scenarioId ?? '',
    config: body.config ?? ({} as WithdrawalStrategyRunInput['config']),
    label: body.label,
    annualReturnOverrides: body.annualReturnOverrides,
    isStressRun: body.isStressRun,
    stressPathId: body.stressPathId,
  };

  const validation = validateWithdrawalStrategyInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
  }

  try {
    const result = await runWithdrawalStrategy(input);
    return NextResponse.json({ run: result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
