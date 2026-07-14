import { clerkClient } from '@clerk/nextjs/server';
import type { Role } from '@/shared/kernel/tenant-context';
import type { InvitationPort } from '../domain/ports/invitation.port';

/**
 * Inverse of mapClerkRole (src/shared/infrastructure/auth/clerk.ts) —
 * maps our domain Role back to the Clerk org-role string expected by
 * createOrganizationInvitation. Only 'student' is exercised by
 * ApproveJoinRequestUseCase today (join requests only ever grant student
 * access), the other cases exist so the adapter stays a faithful, total
 * inverse of mapClerkRole rather than a narrow one-case function.
 */
function toClerkOrgRole(role: Role): 'org:admin' | 'org:instructor' | 'org:student' {
  switch (role) {
    case 'admin':
      return 'org:admin';
    case 'instructor':
      return 'org:instructor';
    default:
      return 'org:student';
  }
}

/**
 * Clerk API error codes that mean "this invitation attempt is redundant"
 * (the email is already a member, or already has a pending invitation to
 * this org) — NOT a genuine failure (design D3 — member short-circuit is
 * deferred to approve-time Clerk idempotency, since `memberships` has no
 * email column to pre-check against).
 *
 * Best-effort allowlist based on Clerk's documented organization-invitation
 * error responses. NOT verified against a live Clerk API response in this
 * sandbox (no Clerk keys available) — flagged explicitly as a risk in
 * apply-progress. Verify against real error payloads when wiring live keys;
 * update this list if the actual codes differ.
 */
const IDEMPOTENT_INVITE_ERROR_CODES = new Set([
  'duplicate_record',
  'already_a_member_in_organization',
  'organization_invitation_already_exists',
]);

/** Duck-typed check — mirrors the codebase's isUniqueViolation() convention
 * (RequestAccessUseCase) rather than importing @clerk/backend's
 * ClerkAPIResponseError class directly: @clerk/backend is a transitive
 * dependency of @clerk/nextjs, not a direct one, so importing its
 * `/errors` subpath would break pnpm's strict node_modules resolution. */
function isIdempotentInviteError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const errors = (err as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      IDEMPOTENT_INVITE_ERROR_CODES.has((e as { code?: unknown }).code as string),
  );
}

/**
 * ClerkInvitationAdapter — implements InvitationPort via
 * clerkClient().organizations.createOrganizationInvitation (design's
 * InvitationPort + adapter section). Idempotent by contract: swallows
 * "already a member / pending invitation" responses so
 * ApproveJoinRequestUseCase never has to special-case that outcome.
 */
export class ClerkInvitationAdapter implements InvitationPort {
  async inviteToAcademy(input: {
    academyId: string;
    email: string;
    role: Role;
    invitedBy: string;
  }): Promise<void> {
    const clerk = await clerkClient();

    try {
      await clerk.organizations.createOrganizationInvitation({
        organizationId: input.academyId,
        emailAddress: input.email,
        role: toClerkOrgRole(input.role),
        inviterUserId: input.invitedBy,
      });
    } catch (err) {
      if (isIdempotentInviteError(err)) return;
      throw err;
    }
  }
}
