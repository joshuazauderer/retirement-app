/**
 * POST /api/social-security   — Run a new SS planning analysis
 * GET  /api/social-security   — List SS runs for the current household
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  runSocialSecurityAnalysis,
  listSocialSecurityRuns,
  validateSocialSecurityInput,
} from '@/server/socialSecurity/socialSecurityService';
import type { SocialSecurityInput } from '@/server/socialSecurity/types';

async function getHouseholdId(userId: string): Promise<string | null> {
  const hh = await prisma.household.findFirst({ where: { primaryUserId: userId } });
  return hh?.id ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) {
    return NextResponse.json({ error: 'No household found.' }, { status: 404 });
  }

  try {
    const runs = await listSocialSecurityRuns(householdId);
    return NextResponse.json({ runs });
  } catch (err) {
    console.error('[social-security GET]', err);
    return NextResponse.json({ error: 'Failed to load SS runs.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const householdId = await getHouseholdId(session.user.id);
  if (!householdId) {
    return NextResponse.json({ error: 'No household found.' }, { status: 404 });
  }

  let body: Partial<SocialSecurityInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const input: SocialSecurityInput = {
    householdId,
    scenarioId: body.scenarioId ?? '',
    label: body.label,
    claimAgeOverrides: body.claimAgeOverrides,
    survivorExpenseRatio: body.survivorExpenseRatio,
  };

  const validation = validateSocialSecurityInput(input);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join('; ') }, { status: 400 });
  }

  try {
    const run = await runSocialSecurityAnalysis(input);
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    console.error('[social-security POST]', err);
    const msg = err instanceof Error ? err.message : 'Failed to run SS analysis.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
