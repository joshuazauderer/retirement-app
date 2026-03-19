/**
 * GET  /api/tax-planning  — List tax-planning runs for the current household
 * POST /api/tax-planning  — Run a new tax-aware projection
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  runTaxPlanningAnalysis,
  listTaxPlanningRuns,
  validateTaxPlanningInput,
} from '@/server/tax/taxPlanningService';
import type { TaxPlanningRunInput } from '@/server/tax/types';
import { simulationRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';
import { handleApiError } from '@/server/errors/errorHandlerService';
import { logger } from '@/server/logging/loggerService';

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
    const runs = await listTaxPlanningRuns(householdId);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error('[tax-planning GET]', err);
    return NextResponse.json({ error: 'Failed to load tax-planning runs.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit
  const rl = simulationRateLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) return NextResponse.json({ error: 'No household found.' }, { status: 404 });

  let body: Partial<TaxPlanningRunInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const input: TaxPlanningRunInput = {
    householdId,
    scenarioId: body.scenarioId ?? '',
    label: body.label,
    taxAssumptions: body.taxAssumptions ?? {},
    withdrawalOrderingType: body.withdrawalOrderingType,
  };

  const validation = validateTaxPlanningInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
  }

  try {
    const run = await runTaxPlanningAnalysis(input);
    logger.info('tax-planning.run', { userId: session.user.id, householdId });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { userId: session.user.id, householdId });
  }
}
