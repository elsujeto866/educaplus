import { and, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { memberships } from '@/shared/infrastructure/db/schema/academy.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Membership } from '../domain/membership.entity';
import type { MembershipRepository } from '../domain/ports/membership.repository';

/**
 * Drizzle implementation of MembershipRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 *
 * Upsert target is the unique constraint on (academy_id, clerk_user_id).
 * Role is always updated to match the latest Clerk event payload.
 */
export class DrizzleMembershipRepository implements MembershipRepository {
  async upsert(ctx: TenantContext, membership: Membership): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .insert(memberships)
        .values({
          id: membership.id,
          academyId: membership.academyId,
          clerkUserId: membership.clerkUserId,
          role: membership.role,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        })
        .onConflictDoUpdate({
          target: [memberships.academyId, memberships.clerkUserId],
          set: {
            role: membership.role,
            updatedAt: new Date(),
          },
        }),
    );
  }

  async findByAcademyAndUser(
    ctx: TenantContext,
    academyId: string,
    clerkUserId: string,
  ): Promise<Membership | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.academyId, academyId),
            eq(memberships.clerkUserId, clerkUserId),
          ),
        );
      const row = rows[0];
      if (!row) return null;
      return new Membership({
        id: row.id,
        academyId: row.academyId,
        clerkUserId: row.clerkUserId,
        role: row.role as 'admin' | 'instructor' | 'student',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    });
  }
}
