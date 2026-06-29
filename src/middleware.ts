import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Public routes — open without authentication or active org membership.
 * The webhook route MUST stay open so Svix can deliver events.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health(.*)',
  '/api/webhooks/(.*)',
]);

/**
 * Clerk middleware — coarse authentication + active org membership guard.
 *
 * Responsibilities (coarse layer only):
 *   1. Pass public routes through unconditionally.
 *   2. Reject unauthenticated users → redirect to /sign-in.
 *   3. Reject authenticated users without an active org → redirect to /sign-in
 *      (Clerk's hosted sign-in flow handles org selection).
 *
 * Does NOT enforce business roles (admin/instructor/student).
 * Fine-grained role checks live in the use-case layer via assertRole().
 */
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  const { userId, orgId } = await auth();

  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  if (!orgId) {
    // Authenticated but no active org — send back to sign-in where Clerk
    // prompts org selection before returning the user to the app.
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT Next.js internals and static assets.
     * This covers both page routes and API routes.
     *
     * Excluded:
     *   _next/static  — static build artifacts
     *   _next/image   — image optimisation
     *   favicon.ico   — browser favicon
     *   common image/font extensions at the path root
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
