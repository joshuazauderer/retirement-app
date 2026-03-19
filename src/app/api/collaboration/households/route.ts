/**
 * GET /api/collaboration/households — List all households accessible to the current user
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listAccessibleHouseholds } from '@/server/collaboration/collaborationService';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const households = await listAccessibleHouseholds(session.user.id);
    return NextResponse.json({ households });
  } catch (e) {
    console.error('[collaboration/households GET]', e);
    return NextResponse.json({ error: 'Failed to load households' }, { status: 500 });
  }
}
