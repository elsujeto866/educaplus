import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Membership } from '../membership.entity';

/**
 * Port: MembershipRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * Upsert semantics on (academyId, clerkUserId) make webhook re-delivery safe.
 */
export interface MembershipRepository {
  /**
   * Idempotent upsert on the unique key (academy_id, clerk_user_id).
   * Updates `role` and `updated_at` on conflict.
   */
  upsert(ctx: TenantContext, membership: Membership): Promise<void>;

  findByAcademyAndUser(
    ctx: TenantContext,
    academyId: string,
    clerkUserId: string,
  ): Promise<Membership | null>;

  /**
   * Hard-delete a membership by (academyId, clerkUserId).
   * Idempotent: deleting a non-existent row is a no-op success.
   */
  delete(ctx: TenantContext, academyId: string, clerkUserId: string): Promise<void>;
}
