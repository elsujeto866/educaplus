import { type NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { env } from '@/shared/config/env';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { handleWebhookEvent } from './event-dispatch';

/**
 * POST /api/webhooks/clerk
 *
 * Receives Clerk webhook events, verifies the Svix signature, then dispatches
 * to the appropriate use-case via the academy composition.
 *
 * PROVENANCE rule: orgId is extracted ONLY from the Svix-verified payload —
 * never from request params, query strings, or body fields outside the
 * verified event data.
 *
 * Returns 200 on success (and for unknown/unhandled event types), 400 when
 * the Svix signature is invalid or required headers are missing.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Collect the Svix signature headers before reading the body.
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix signature headers' }, { status: 400 });
  }

  // Read the raw body — Svix verifies against the unmodified string.
  const rawBody = await req.text();

  // Verify the Svix signature. new Webhook() is created inside the handler
  // (not at module scope) so CLERK_WEBHOOK_SECRET is only read at request
  // time, keeping `next build` safe without live env vars.
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  let event: WebhookEvent;

  try {
    event = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  await handleWebhookEvent(event, makeAcademyComposition());

  return NextResponse.json({ received: true });
}
