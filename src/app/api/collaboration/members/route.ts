/**
 * GET  /api/collaboration/members?householdId=xxx — List household members
 * DELETE /api/collaboration/members — Remove a member
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listHouseholdMembers, removeMember } from '@/server/collaboration/collaborationService';
import { withPermission } from '@/server/collaboration/withPermission';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = req.nextUrl.searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId is required' }, { status: 400 });

  const [, err] = await withPermission(session.user.id, householdId, (p) => p.canViewHousehold);
  if (err) return err;

  try {
    const members = await listHouseholdMembers(householdId);
    return NextResponse.json({ members });
  } catch (e) {
    console.error('[collaboration/members GET]', e);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { householdId?: string; targetUserId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { householdId, targetUserId } = body;
  if (!householdId || !targetUserId) {
    return NextResponse.json({ error: 'householdId and targetUserId are required' }, { status: 400 });
  }

  const [, err] = await withPermission(session.user.id, householdId, (p) => p.canManageAccess);
  if (err) return err;

  const result = await removeMember(householdId, targetUserId, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
