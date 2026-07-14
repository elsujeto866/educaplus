/**
 * Middleware unit test — public route matcher.
 *
 * PR2 requires /a/[slug] to be reachable by unauthenticated visitors (spec
 * "Known slug renders public page" / "Unknown slug returns 404" — neither
 * scenario is testable if middleware redirects the visitor to /sign-in
 * first). Captures the pattern list passed to createRouteMatcher() rather
 * than re-implementing Clerk's matcher, so this test fails loudly (RED) if
 * the '/a/(.*)' pattern is ever removed, without depending on Clerk's
 * internal matching implementation.
 *
 * @clerk/nextjs/server is mocked — same pattern as webhook-routing.spec.ts —
 * because it uses server-only guards that throw outside the Next.js runtime.
 */

import { describe, it, expect, vi } from 'vitest';

let capturedPatterns: unknown[] = [];

vi.mock('@clerk/nextjs/server', () => ({
  createRouteMatcher: vi.fn((patterns: unknown[]) => {
    capturedPatterns = patterns;
    return () => false;
  }),
  clerkMiddleware: vi.fn((handler: unknown) => handler),
}));

vi.mock('next/server', () => ({
  NextResponse: { redirect: vi.fn() },
}));

describe('middleware public routes', () => {
  it('registers /a/(.*) as a public route alongside sign-in/sign-up/webhooks', async () => {
    await import('../../src/middleware');

    expect(capturedPatterns).toContain('/a/(.*)');
    expect(capturedPatterns).toContain('/');
    expect(capturedPatterns).toContain('/sign-in(.*)');
    expect(capturedPatterns).toContain('/api/webhooks/(.*)');
  });
});
