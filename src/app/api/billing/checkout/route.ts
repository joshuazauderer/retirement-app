import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCheckoutSession } from '@/server/billing/billingService';
import { handleApiError } from '@/server/errors/errorHandlerService';
import type { PlanType } from '@/server/billing/types';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { planType?: string; householdId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { planType } = body;
  if (!planType || (planType !== 'PRO' && planType !== 'ADVISOR')) {
    return NextResponse.json({ error: 'planType must be PRO or ADVISOR' }, { status: 400 });
  }

  try {
    const result = await createCheckoutSession(session.user.id, planType as PlanType);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { userId: session.user.id });
  }
}
