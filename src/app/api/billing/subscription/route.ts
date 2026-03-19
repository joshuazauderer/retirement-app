import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserSubscription } from '@/server/billing/subscriptionService';
import { checkMultipleFeatures } from '@/server/billing/featureGateService';
import { handleApiError } from '@/server/errors/errorHandlerService';
import type { FeatureName } from '@/server/billing/types';

const ALL_FEATURES: FeatureName[] = [
  'monte_carlo',
  'ai_insights',
  'ai_copilot',
  'advanced_scenarios',
  'tax_planning',
  'healthcare_planning',
  'housing_planning',
  'reports_export',
  'csv_export',
  'collaboration',
  'advisor_access',
  'unlimited_simulations',
  'unlimited_scenarios',
];

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [subscription, features] = await Promise.all([
      getUserSubscription(session.user.id),
      checkMultipleFeatures(session.user.id, ALL_FEATURES),
    ]);

    return NextResponse.json({ subscription, features });
  } catch (err) {
    return handleApiError(err, { userId: session.user.id });
  }
}
