import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { MembershipRepository } from '../domain/ports/membership.repository';

export interface DeleteMembershipInput {
  academyId: string;
  clerkUserId: string;
}

/**
 * DeleteMembershipUseCase — hard-deletes a membership.
 *
 * Called by the Clerk webhook delivery layer for
 * `organizationMembership.deleted` events. Idempotent: deleting a
 * non-existent membership is a no-op success (the row is already gone).
 *
 * No role assertion — webhook identity is pre-verified by Svix and
 * the delete is scoped to the webhook's own tenant via withTenant.
 * Mirrors the SyncMembershipUseCase pattern exactly.
 */
export class DeleteMembershipUseCase {
  constructor(private readonly membershipRepo: MembershipRepository) {}

  async execute(ctx: TenantContext, input: DeleteMembershipInput): Promise<void> {
    await this.membershipRepo.delete(ctx, input.academyId, input.clerkUserId);
  }
}
