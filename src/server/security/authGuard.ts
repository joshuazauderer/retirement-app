/**
 * authGuard — reusable auth check for API routes.
 *
 * Usage:
 *   const [userId, authError] = await requireAuth();
 *   if (authError) return authError;
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Require authentication. Returns [userId, null] or [null, errorResponse].
 */
export async function requireAuth(): Promise<[string, null] | [null, NextResponse]> {
  const session = await auth();
  if (!session?.user?.id) {
    return [null, NextResponse.json({ error: 'Unauthorized' }, { status: 401 })];
  }
  return [session.user.id, null];
}
