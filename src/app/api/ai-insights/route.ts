import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateInsight } from '@/server/ai/aiInsightService';
import { validateInsightInput } from '@/server/ai/insightFormatterService';
import type { InsightInput } from '@/server/ai/types';
import { prisma } from '@/lib/prisma';
import { aiRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';
import { handleApiError } from '@/server/errors/errorHandlerService';
import { requireFeature } from '@/server/billing/featureGateService';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Feature gate — ai_insights requires PRO or ADVISOR plan
  try {
    await requireFeature(session.user.id, 'ai_insights');
  } catch (err) {
    if (err instanceof Error && err.message === 'FEATURE_GATED') {
      return NextResponse.json(
        { error: 'This feature requires a Pro subscription.', upgradeRequired: true, upgradeUrl: '/app/settings/billing' },
        { status: 402 }
      );
    }
    throw err;
  }

  // Rate limit
  const rl = aiRateLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const body = await req.json() as Partial<InsightInput>;

    // Verify household belongs to user
    if (!body.householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 });

    const household = await prisma.household.findFirst({
      where: { id: body.householdId, primaryUserId: session.user.id },
    });
    if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 });

    const validation = validateInsightInput(body as InsightInput);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
    }

    const result = await generateInsight(body as InsightInput);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { userId: session.user.id });
  }
}
