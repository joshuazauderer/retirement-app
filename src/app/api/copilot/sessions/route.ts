import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listSessions } from '@/server/conversation/conversationStateService';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const householdId = searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId required' }, { status: 400 });

  const sessions = await listSessions(householdId, session.user.id);
  return NextResponse.json({ sessions });
}
