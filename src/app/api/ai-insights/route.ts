import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateInsight } from '@/server/ai/aiInsightService';
import { validateInsightInput } from '@/server/ai/insightFormatterService';
import type { InsightInput } from '@/server/ai/types';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}
