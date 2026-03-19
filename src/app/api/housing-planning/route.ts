/**
 * GET  /api/housing-planning  — List housing planning runs for the current household
 * POST /api/housing-planning  — Run a new housing + legacy projection
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  runHousingPlanningAnalysis,
  listHousingPlanningRuns,
} from '@/server/housing/housingPlanningService';
import { validateHousingPlanningInput } from '@/server/housing/housingAssumptionService';
import type { HousingPlanningInput } from '@/server/housing/types';
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
    const runs = await listHousingPlanningRuns(householdId);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error('[housing-planning GET]', err);
    return NextResponse.json({ error: 'Failed to load housing planning runs.' }, { status: 500 });
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

  let body: Partial<HousingPlanningInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const input: HousingPlanningInput = {
    householdId,
    scenarioId: body.scenarioId ?? '',
    label: body.label ?? '',
    strategy: body.strategy ?? 'stay_in_place',
    currentProperty: body.currentProperty ?? {
      currentValue: 0,
      mortgageBalance: 0,
      annualAppreciationRate: 0.03,
      annualHousingCost: 0,
      annualMortgagePayment: 0,
    },
    downsizing: body.downsizing ?? {
      enabled: false,
      eventYear: new Date().getFullYear() + 5,
      expectedSalePrice: 0,
      sellingCostPercent: 0.06,
      mortgagePayoffAmount: 0,
      buyReplacementHome: false,
      replacementHomeCost: 0,
      replacementHomeMortgage: 0,
      postMoveAnnualHousingCost: 0,
      oneTimeMoveCost: 0,
    },
    relocation: body.relocation ?? {
      enabled: false,
      eventYear: new Date().getFullYear() + 5,
      destinationState: '',
      newAnnualHousingCost: 0,
      oneTimeMoveCost: 0,
      buyReplacementHome: false,
      replacementHomeCost: 0,
      replacementHomeMortgage: 0,
    },
    gifting: body.gifting ?? {
      enabled: false,
      annualGiftAmount: 0,
    },
    includeLegacyProjection: body.includeLegacyProjection ?? true,
    generalInflationRate: body.generalInflationRate ?? 0.025,
  };

  const validation = validateHousingPlanningInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
  }

  try {
    const result = await runHousingPlanningAnalysis(input, session.user.id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    logger.info('housing-planning.run', { userId: session.user.id, householdId });
    return NextResponse.json({ runId: result.runId }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { userId: session.user.id, householdId });
  }
}
