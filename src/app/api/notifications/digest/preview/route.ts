/**
 * GET /api/notifications/digest/preview — preview digest content for the current user.
 *
 * Returns the assembled digest sections without sending an email.
 * Useful for the settings page to show users what their digest looks like.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAuth }        from '@/server/security/authGuard';
import { assembleDigest }     from '@/server/notifications/digestAssemblyService';
import { handleApiError }     from '@/server/errors/errorHandlerService';
import { generalRateLimit, rateLimitHeaders } from '@/server/security/rateLimitService';
import { auth }               from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const [userId, authError] = await requireAuth();
    if (authError) return authError;

    const rl = generalRateLimit(userId);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) });
    }

    // Get session for user email + name
    const session = await auth();
    const userEmail     = session?.user?.email ?? '';
    const userFirstName = extractFirstName(session?.user?.name ?? userEmail);

    // Get household for this user
    const household = await prisma.household.findFirst({
      where: { primaryUserId: userId },
    });

    if (!household) {
      return NextResponse.json({ error: 'No household found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const frequency = searchParams.get('frequency') === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY';

    const content = await assembleDigest({
      userId,
      householdId:  household.id,
      userEmail,
      userFirstName,
      frequency,
      prisma,
    });

    if (!content) {
      return NextResponse.json({
        preview: null,
        message: 'Not enough planning data to generate a digest. Run some simulations to get started.',
      });
    }

    return NextResponse.json({ preview: content });
  } catch (err) {
    return handleApiError(err);
  }
}

function extractFirstName(nameOrEmail: string): string {
  if (nameOrEmail.includes('@')) return nameOrEmail.split('@')[0];
  return nameOrEmail.split(' ')[0];
}
