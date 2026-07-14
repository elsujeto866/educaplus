/**
 * ClerkInvitationAdapter unit tests — mocked clerkClient, no live Clerk keys
 * required (per apply instructions: the real Clerk call is deferred to the
 * user's environment).
 *
 * Covers task 3.5:
 *   - success path: calls createOrganizationInvitation with
 *     { organizationId, emailAddress, role: 'org:student', inviterUserId }.
 *   - idempotency path: an "already a member / pending invitation" error
 *     response (duck-typed ClerkAPIResponseError shape — `errors: [{code}]`)
 *     is swallowed, NOT rethrown (design D3 member short-circuit).
 *   - genuine failure (unrelated error code / network error) is rethrown,
 *     NOT swallowed.
 */

import { describe, it, expect, vi } from 'vitest';

const createOrganizationInvitation = vi.fn();

// Mock @clerk/nextjs/server before any import that pulls it in — same
// convention as tests/unit/clerk-adapter.spec.ts (server-only guards throw
// outside the Next.js runtime otherwise).
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn(async () => ({
    organizations: { createOrganizationInvitation },
  })),
}));

import { ClerkInvitationAdapter } from '../../../src/modules/academy/infrastructure/clerk-invitation.adapter';

/** Mirrors the shape of @clerk/backend's ClerkAPIResponseError (duck-typed). */
function clerkApiError(code: string, status = 422): unknown {
  return { status, errors: [{ code, message: code }] };
}

describe('ClerkInvitationAdapter.inviteToAcademy', () => {
  it('calls createOrganizationInvitation with role org:student', async () => {
    createOrganizationInvitation.mockReset().mockResolvedValue({ id: 'inv_1' });
    const adapter = new ClerkInvitationAdapter();

    await adapter.inviteToAcademy({
      academyId: 'org_A',
      email: 'new@student.com',
      role: 'student',
      invitedBy: 'user_A1',
    });

    expect(createOrganizationInvitation).toHaveBeenCalledWith({
      organizationId: 'org_A',
      emailAddress: 'new@student.com',
      role: 'org:student',
      inviterUserId: 'user_A1',
    });
  });

  it('treats an "already a member" duplicate error as success (idempotent)', async () => {
    createOrganizationInvitation.mockReset().mockRejectedValue(clerkApiError('duplicate_record'));
    const adapter = new ClerkInvitationAdapter();

    await expect(
      adapter.inviteToAcademy({
        academyId: 'org_A',
        email: 'already@student.com',
        role: 'student',
        invitedBy: 'user_A1',
      }),
    ).resolves.toBeUndefined();
  });

  it('treats an "already a member in organization" error as success (idempotent)', async () => {
    createOrganizationInvitation
      .mockReset()
      .mockRejectedValue(clerkApiError('already_a_member_in_organization'));
    const adapter = new ClerkInvitationAdapter();

    await expect(
      adapter.inviteToAcademy({
        academyId: 'org_A',
        email: 'already@student.com',
        role: 'student',
        invitedBy: 'user_A1',
      }),
    ).resolves.toBeUndefined();
  });

  it('rethrows a genuine (non-idempotent) failure', async () => {
    createOrganizationInvitation.mockReset().mockRejectedValue(new Error('network error'));
    const adapter = new ClerkInvitationAdapter();

    await expect(
      adapter.inviteToAcademy({
        academyId: 'org_A',
        email: 'new@student.com',
        role: 'student',
        invitedBy: 'user_A1',
      }),
    ).rejects.toThrow('network error');
  });

  it('rethrows a ClerkAPIResponseError-shaped error with an unrelated code', async () => {
    createOrganizationInvitation.mockReset().mockRejectedValue(clerkApiError('form_param_invalid'));
    const adapter = new ClerkInvitationAdapter();

    await expect(
      adapter.inviteToAcademy({
        academyId: 'org_A',
        email: 'bad-email',
        role: 'student',
        invitedBy: 'user_A1',
      }),
    ).rejects.toBeDefined();
  });
});
