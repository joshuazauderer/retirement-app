/**
 * GET  /api/healthcare-planning  — List healthcare planning runs for the current household
 * POST /api/healthcare-planning  — Run a new healthcare cost projection
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  runHealthcarePlanningAnalysis,
  listHealthcarePlanningRuns,
  validateHealthcarePlanningInput,
} from '@/server/healthcare/healthcarePlanningService';
import type { HealthcarePlanningInput } from '@/server/healthcare/types';
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
    const runs = await listHealthcarePlanningRuns(householdId);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error('[healthcare-planning GET]', err);
    return NextResponse.json({ error: 'Failed to load healthcare planning runs.' }, { status: 500 });
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

  let body: Partial<HealthcarePlanningInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const input: HealthcarePlanningInput = {
    householdId,
    scenarioId: body.scenarioId ?? '',
    label: body.label ?? '',
    preMedicare: body.preMedicare ?? { annualPremium: 0, annualOutOfPocket: 0 },
    medicareEligibilityAge: body.medicareEligibilityAge ?? 65,
    medicare: body.medicare ?? {
      includePartB: true,
      includePartD: true,
      includeMedigapOrAdvantage: true,
      additionalAnnualOOP: 0,
    },
    healthcareInflationRate: body.healthcareInflationRate ?? 0.05,
    ltcStress: body.ltcStress ?? {
      enabled: false,
      startAge: 80,
      durationYears: 3,
      annualCost: 90000,
    },
    longevityStress: body.longevityStress ?? {
      enabled: false,
      targetAge: 95,
      person: 'primary',
    },
    includeSpouseHealthcare: body.includeSpouseHealthcare ?? false,
  };

  const validation = validateHealthcarePlanningInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
  }

  try {
    const result = await runHealthcarePlanningAnalysis(input, session.user.id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    logger.info('healthcare-planning.run', { userId: session.user.id, householdId });
    return NextResponse.json({ runId: result.runId }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { userId: session.user.id, householdId });
  }
}
