import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Email } from '../domain/value-objects/email.vo';
import type { JoinRequestRepository } from '../domain/ports/join-request.repository';

export interface FulfillJoinRequestInput {
  academyId: string;
  /** Raw email from the webhook payload — normalized before matching. */
  email: string;
  membershipId: string;
}

/**
 * FulfillJoinRequestUseCase — reconciliation (Phase 4).
 *
 * Called from the Clerk webhook's `organizationMembership.created` handler,
 * AFTER `SyncMembershipUseCase`, inside the same `withTenant` transaction
 * (system/admin ctx, orgId-scoped — the standard tenant path, NOT the public
 * `academy_public` role). Match key: (academyId, normalized email,
 * status='approved', fulfilledAt IS NULL) — email is the only join key since
 * `memberships` has no email column (design D3).
 *
 * Idempotent by construction: `findApprovedUnfulfilled` only ever returns
 * unfulfilled rows, so a webhook re-delivery (or a membership created
 * directly by an admin with no matching request) finds nothing and this is
 * a silent no-op — it must never throw or double-write (spec "Orphan
 * approved request has no day-1 expiry").
 */
export class FulfillJoinRequestUseCase {
  constructor(private readonly joinRequestRepo: JoinRequestRepository) {}

  async execute(ctx: TenantContext, input: FulfillJoinRequestInput): Promise<void> {
    const normalizedEmail = Email.create(input.email).value;

    const request = await this.joinRequestRepo.findApprovedUnfulfilled(
      ctx,
      input.academyId,
      normalizedEmail,
    );
    if (!request) return;

    const fulfilled = request.fulfill(input.membershipId);
    await this.joinRequestRepo.save(ctx, fulfilled);
  }
}
