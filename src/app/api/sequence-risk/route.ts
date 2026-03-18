import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runSequenceRiskAnalysis, STRESS_PATHS } from '@/server/withdrawalStrategies/sequenceRiskStressService';
import type { WithdrawalStrategyRunInput } from '@/server/withdrawalStrategies/types';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

/** GET /api/sequence-risk — list available stress paths */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ stressPaths: STRESS_PATHS });
}

/**
 * POST /api/sequence-risk
 * Body: { scenarioId, config, stressPathIds?, label?, existingBaselineRunId? }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'Household not found.' }, { status: 404 });

  let body: {
    scenarioId?: string;
    config?: WithdrawalStrategyRunInput['config'];
    stressPathIds?: string[];
    label?: string;
    existingBaselineRunId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.scenarioId || !body.config) {
    return NextResponse.json({ error: 'scenarioId and config are required.' }, { status: 400 });
  }

  const input: WithdrawalStrategyRunInput = {
    householdId,
    scenarioId: body.scenarioId,
    config: body.config,
    label: body.label,
  };

  try {
    const result = await runSequenceRiskAnalysis(
      input,
      body.stressPathIds,
      body.existingBaselineRunId
    );
    return NextResponse.json({ result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sequence risk analysis failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
