/**
 * POST /api/notifications/read-all — mark all unread notifications as read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth }                 from '@/server/security/authGuard';
import { markAllNotificationsRead }    from '@/server/notifications/inAppNotificationService';
import { handleApiError }              from '@/server/errors/errorHandlerService';

const prisma = new PrismaClient();

export async function POST(_req: NextRequest): Promise<NextResponse> {
  try {
    const [userId, authError] = await requireAuth();
    if (authError) return authError;

    const count = await markAllNotificationsRead(userId, prisma);

    return NextResponse.json({ markedRead: count });
  } catch (err) {
    return handleApiError(err);
  }
}
