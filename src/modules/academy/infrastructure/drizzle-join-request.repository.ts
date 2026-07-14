import { and, asc, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { joinRequests } from '@/shared/infrastructure/db/schema/academy.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { JoinRequest } from '../domain/entities/join-request.entity';
import type { RequestStatusValue } from '../domain/value-objects/request-status.vo';
import type { JoinRequestRepository } from '../domain/ports/join-request.repository';

/**
 * Drizzle implementation of JoinRequestRepository — ADMIN/TENANT path
 * (Phase 3). ALL table access goes through withTenant(), same convention
 * as DrizzleMembershipRepository/DrizzleAcademyRepository.
 */
export class DrizzleJoinRequestRepository implements JoinRequestRepository {
  async listPendingByAcademy(ctx: TenantContext): Promise<JoinRequest[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(joinRequests)
        .where(and(eq(joinRequests.academyId, ctx.orgId), eq(joinRequests.status, 'pending')))
        .orderBy(asc(joinRequests.createdAt));
      return rows.map(toEntity);
    });
  }

  async findById(ctx: TenantContext, id: string): Promise<JoinRequest | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(joinRequests).where(eq(joinRequests.id, id));
      const row = rows[0];
      return row ? toEntity(row) : null;
    });
  }

  async save(ctx: TenantContext, joinRequest: JoinRequest): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .insert(joinRequests)
        .values({
          id: joinRequest.id,
          academyId: joinRequest.academyId,
          email: joinRequest.email,
          status: joinRequest.status,
          createdAt: joinRequest.createdAt,
          resolvedAt: joinRequest.resolvedAt,
          resolvedBy: joinRequest.resolvedBy,
          fulfilledAt: joinRequest.fulfilledAt,
          membershipId: joinRequest.membershipId,
        })
        .onConflictDoUpdate({
          target: joinRequests.id,
          set: {
            status: joinRequest.status,
            resolvedAt: joinRequest.resolvedAt,
            resolvedBy: joinRequest.resolvedBy,
            fulfilledAt: joinRequest.fulfilledAt,
            membershipId: joinRequest.membershipId,
          },
        }),
    );
  }

  async findApprovedUnfulfilled(
    ctx: TenantContext,
    academyId: string,
    email: string,
  ): Promise<JoinRequest | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.academyId, academyId),
            eq(joinRequests.email, email),
            eq(joinRequests.status, 'approved'),
          ),
        );
      const row = rows.find((r) => r.fulfilledAt === null);
      return row ? toEntity(row) : null;
    });
  }
}

type JoinRequestRow = typeof joinRequests.$inferSelect;

function toEntity(row: JoinRequestRow): JoinRequest {
  return JoinRequest.reconstitute({
    id: row.id,
    academyId: row.academyId,
    email: row.email,
    status: row.status as RequestStatusValue,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
    fulfilledAt: row.fulfilledAt,
    membershipId: row.membershipId,
  });
}
