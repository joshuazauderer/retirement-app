/**
 * GET /api/notifications — list notifications for the authenticated user.
 *
 * Query params:
 *   unreadOnly=true  — return only unread notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth }           from '@/server/security/authGuard';
import { listNotifications }     from '@/server/notifications/inAppNotificationService';
import { handleApiError }        from '@/server/errors/errorHandlerService';
import { generalRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';

const prisma = new PrismaClient();

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const [userId, authError] = await requireAuth();
    if (authError) return authError;

    const rl = generalRateLimit(userId);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const result = await listNotifications(userId, prisma, { includeRead: !unreadOnly });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
