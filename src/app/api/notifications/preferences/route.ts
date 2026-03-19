/**
 * GET  /api/notifications/preferences — fetch notification preferences.
 * PATCH /api/notifications/preferences — update notification preferences.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth }                   from '@/server/security/authGuard';
import { getNotificationPreferences,
         updateNotificationPreferences } from '@/server/notifications/notificationPreferenceService';
import { handleApiError }                from '@/server/errors/errorHandlerService';
import { generalRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';

const prisma = new PrismaClient();

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const [userId, authError] = await requireAuth();
    if (authError) return authError;

    const prefs = await getNotificationPreferences(userId, prisma);
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const [userId, authError] = await requireAuth();
    if (authError) return authError;

    const rl = generalRateLimit(userId);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) });
    }

    const body = await req.json() as Record<string, unknown>;

    // Sanitise — only allow known preference fields
    const allowed = ['emailDigest', 'digestFrequency', 'planRiskAlerts', 'collaborationAlerts', 'billingAlerts', 'simulationAlerts'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    // Validate digestFrequency if provided
    if (updates.digestFrequency !== undefined) {
      if (!['WEEKLY', 'MONTHLY', 'NEVER'].includes(updates.digestFrequency as string)) {
        return NextResponse.json(
          { error: 'digestFrequency must be WEEKLY, MONTHLY, or NEVER' },
          { status: 400 },
        );
      }
    }

    const prefs = await updateNotificationPreferences(userId, updates, prisma);
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    return handleApiError(err);
  }
}
