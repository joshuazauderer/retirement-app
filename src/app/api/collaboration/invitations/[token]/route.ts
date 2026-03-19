/**
 * GET  /api/collaboration/invitations/[token] — Look up invitation details (semi-public)
 * POST /api/collaboration/invitations/[token] — Accept invitation (authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getInvitationByToken, acceptInvitation } from '@/server/collaboration/invitationService';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

  try {
    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found, expired, or already used' }, { status: 404 });
    }

    // Return limited public info (omit the token itself from the response)
    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        permissionLevel: invitation.permissionLevel,
        expiresAt: invitation.expiresAt,
        householdName: invitation.householdName,
        invitedByEmail: invitation.invitedByEmail,
      },
    });
  } catch (e) {
    console.error('[collaboration/invitations/[token] GET]', e);
    return NextResponse.json({ error: 'Failed to look up invitation' }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await params;
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

  try {
    const result = await acceptInvitation(token, session.user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, householdId: result.householdId });
  } catch (e) {
    console.error('[collaboration/invitations/[token] POST]', e);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
