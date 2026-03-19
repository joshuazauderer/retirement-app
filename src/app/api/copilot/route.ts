import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleCopilotMessage } from '@/server/conversation/conversationalOrchestratorService';
import { prisma } from '@/lib/prisma';
import type { CopilotRequest } from '@/server/conversation/types';
import { copilotRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';
import { handleApiError } from '@/server/errors/errorHandlerService';
import { requireFeature } from '@/server/billing/featureGateService';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Feature gate — ai_copilot requires PRO or ADVISOR plan
  try {
    await requireFeature(session.user.id, 'ai_copilot');
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
  const rl = copilotRateLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  try {
    const body = await req.json() as Partial<CopilotRequest>;

    if (!body.householdId || !body.message?.trim()) {
      return NextResponse.json({ error: 'householdId and message are required' }, { status: 400 });
    }

    // Verify household belongs to user
    const household = await prisma.household.findFirst({
      where: { id: body.householdId, primaryUserId: session.user.id },
    });
    if (!household) return NextResponse.json({ error: 'Household not found' }, { status: 404 });

    const result = await handleCopilotMessage(body as CopilotRequest, session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { userId: session.user.id });
  }
}
