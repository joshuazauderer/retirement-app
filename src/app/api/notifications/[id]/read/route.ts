/**
 * POST /api/notifications/[id]/read — mark a single notification as read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth }              from '@/server/security/authGuard';
import { markNotificationRead }     from '@/server/notifications/inAppNotificationService';
import { handleApiError }           from '@/server/errors/errorHandlerService';

const prisma = new PrismaClient();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const [userId, authError] = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const notification = await markNotificationRead(id, userId, prisma);

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ notification });
  } catch (err) {
    return handleApiError(err);
  }
}
