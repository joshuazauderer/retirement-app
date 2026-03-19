import { NextRequest, NextResponse } from 'next/server';
import { parseWebhookEvent, processWebhookEvent } from '@/server/billing/stripeWebhookService';
import { logger } from '@/server/logging/loggerService';

// Required for raw body access — must be nodejs runtime
export const runtime = 'nodejs';

// No auth on webhook route — Stripe calls this directly
// Security is enforced via webhook signature verification
export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // NOT req.json() — required for signature verification
  const signature = req.headers.get('stripe-signature') ?? '';

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: import('stripe').Stripe.Event;
  try {
    event = await parseWebhookEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    logger.warn('stripe.webhook.signature_failed', { action: 'signature_verification_failed' });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await processWebhookEvent(event);
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (err) {
    // Log but return 200 — Stripe retries on 5xx, not on 2xx
    logger.error('stripe.webhook.processing_failed', { action: 'processing_failed', requestId: event.id }, err instanceof Error ? err : undefined);
    // Return 200 to prevent Stripe retries for non-transient errors
    return NextResponse.json({ received: true, handled: false, error: 'Processing failed' });
  }
}
