import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { handleCopilotMessage } from '@/server/conversation/conversationalOrchestratorService';
import { prisma } from '@/lib/prisma';
import type { CopilotRequest } from '@/server/conversation/types';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}
