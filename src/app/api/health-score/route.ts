/**
 * GET /api/health-score
 * Returns the computed retirement health score for the authenticated user's household.
 * Phase 18 — Retirement Health Score Engine
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeHealthScore } from '@/server/health/healthScoreService';
import { handleApiError } from '@/server/errors/errorHandlerService';
import { generalRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';

export async function GET() {
  try {
    // Auth
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const rl = generalRateLimit(session.user.id);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }

    // Resolve household
    const household = await prisma.household.findUnique({
      where: { primaryUserId: session.user.id },
      select: { id: true },
    });

    if (!household) {
      return NextResponse.json(
        { error: 'Household not found. Complete onboarding first.' },
        { status: 404 },
      );
    }

    // Compute score
    const result = await computeHealthScore(household.id, prisma);

    return NextResponse.json(result, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err);
  }
}
