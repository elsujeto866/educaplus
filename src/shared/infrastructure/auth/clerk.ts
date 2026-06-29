import { auth } from '@clerk/nextjs/server';
import type { TenantContext, Role } from '@/shared/kernel/tenant-context';
import { MissingTenantContextError } from '@/shared/kernel/tenant-context';

/**
 * Maps a Clerk org-role string to our domain Role type.
 *
 * Known built-in Clerk roles:
 *   org:admin       → 'admin'
 *   org:instructor  → 'instructor'  (custom role; configure in Clerk dashboard)
 *   org:member / org:student / anything else → 'student'
 *
 * Exported so the webhook route can reuse the same mapping
 * and unit tests can exercise it in isolation.
 */
export function mapClerkRole(orgRole: string | null | undefined): Role {
  switch (orgRole) {
    case 'org:admin':
      return 'admin';
    case 'org:instructor':
      return 'instructor';
    default:
      return 'student';
  }
}

/**
 * getTenantContext — Clerk session → TenantContext adapter.
 *
 * Reads the Clerk-verified session via auth() and returns a TenantContext.
 *
 * PROVENANCE rule: orgId comes ONLY from the verified Clerk session —
 * never from request params, query strings, or body.
 *
 * Throws MissingTenantContextError when:
 *   - user is not authenticated (no userId)
 *   - user has no active org in the session (no orgId)
 */
export async function getTenantContext(): Promise<TenantContext> {
  const { userId, orgId, orgRole } = await auth();

  if (!userId || !orgId) {
    throw new MissingTenantContextError();
  }

  return {
    orgId,
    userId,
    role: mapClerkRole(orgRole),
  };
}
