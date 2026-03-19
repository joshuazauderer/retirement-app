/**
 * GET    /api/collaboration/invitations?householdId=xxx — List pending invitations
 * POST   /api/collaboration/invitations — Create invitation
 * DELETE /api/collaboration/invitations — Revoke invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  listPendingInvitations,
  createInvitation,
  revokeInvitation,
} from '@/server/collaboration/invitationService';
import { withPermission } from '@/server/collaboration/withPermission';
import type { HouseholdRole, PermissionLevel } from '@/server/collaboration/types';
import { generalRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';
import { handleApiError } from '@/server/errors/errorHandlerService';
import { requireFeature } from '@/server/billing/featureGateService';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const householdId = req.nextUrl.searchParams.get('householdId');
  if (!householdId) return NextResponse.json({ error: 'householdId is required' }, { status: 400 });

  const [, err] = await withPermission(session.user.id, householdId, (p) => p.canManageAccess);
  if (err) return err;

  try {
    const invitations = await listPendingInvitations(householdId);
    return NextResponse.json({ invitations });
  } catch (e) {
    console.error('[collaboration/invitations GET]', e);
    return NextResponse.json({ error: 'Failed to list invitations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Feature gate — collaboration requires PRO or ADVISOR plan
  try {
    await requireFeature(session.user.id, 'collaboration');
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
  const rl = generalRateLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let body: { householdId?: string; email?: string; role?: string; permissionLevel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { householdId, email, role, permissionLevel } = body;
  if (!householdId || !email || !role) {
    return NextResponse.json({ error: 'householdId, email, and role are required' }, { status: 400 });
  }

  const [, err] = await withPermission(session.user.id, householdId, (p) => p.canManageAccess);
  if (err) return err;

  try {
    const result = await createInvitation(
      householdId,
      session.user.id,
      email,
      role as HouseholdRole,
      permissionLevel as PermissionLevel | undefined,
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ invitation: result.invitation }, { status: 201 });
  } catch (err2) {
    return handleApiError(err2, { userId: session.user.id, householdId });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { invitationId?: string; householdId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { invitationId, householdId } = body;
  if (!invitationId || !householdId) {
    return NextResponse.json({ error: 'invitationId and householdId are required' }, { status: 400 });
  }

  const [, err] = await withPermission(session.user.id, householdId, (p) => p.canManageAccess);
  if (err) return err;

  const result = await revokeInvitation(invitationId, session.user.id, householdId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
