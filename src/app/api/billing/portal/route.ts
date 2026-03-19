import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createBillingPortalSession } from '@/server/billing/billingService';
import { handleApiError } from '@/server/errors/errorHandlerService';

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await createBillingPortalSession(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { userId: session.user.id });
  }
}
