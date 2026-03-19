import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUsageSummary } from '@/server/billing/usageLimitService';
import { handleApiError } from '@/server/errors/errorHandlerService';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = req.nextUrl.searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId is required' }, { status: 400 });

  try {
    const usage = await getUsageSummary(session.user.id, householdId);
    return NextResponse.json(usage);
  } catch (err) {
    return handleApiError(err, { userId: session.user.id, householdId });
  }
}
