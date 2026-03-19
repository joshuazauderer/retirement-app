/**
 * GET /api/collaboration/activity?householdId=xxx — List household collaboration activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listHouseholdActivity } from '@/server/collaboration/accessAuditService';
import { withPermission } from '@/server/collaboration/withPermission';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = req.nextUrl.searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId is required' }, { status: 400 });

  const [, err] = await withPermission(session.user.id, householdId, (p) => p.canViewHousehold);
  if (err) return err;

  try {
    const activities = await listHouseholdActivity(householdId, 50);
    return NextResponse.json({ activities });
  } catch (e) {
    console.error('[collaboration/activity GET]', e);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
