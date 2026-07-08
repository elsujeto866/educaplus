import { and, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { simulatorTrackProgress } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrackProgress } from '../domain/simulator-track-progress.entity';
import type { SimulatorTrackProgressRepository } from '../domain/ports/simulator-track-progress.repository';

/**
 * Maps a raw DB row to a SimulatorTrackProgress entity.
 */
function toEntity(row: typeof simulatorTrackProgress.$inferSelect): SimulatorTrackProgress {
  return new SimulatorTrackProgress({
    id: row.id,
    trackId: row.trackId,
    academyId: row.academyId,
    clerkUserId: row.clerkUserId,
    highestUnlockedPosition: row.highestUnlockedPosition,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of SimulatorTrackProgressRepository — mirrors
 * `DrizzleSimulatorCertificateRepository` verbatim.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * unique(track_id, clerk_user_id) backs `create` — a concurrent first-pass
 * insert race surfaces as a Postgres unique-violation (SQLSTATE 23505),
 * which propagates unmodified to the caller
 * (`AdvanceProgressOnPassUseCase` re-reads and returns the winning row
 * instead of surfacing the DB error).
 */
export class DrizzleSimulatorTrackProgressRepository implements SimulatorTrackProgressRepository {
  async findByTrackAndUser(
    ctx: TenantContext,
    trackId: string,
    clerkUserId: string,
  ): Promise<SimulatorTrackProgress | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(simulatorTrackProgress)
        .where(
          and(
            eq(simulatorTrackProgress.trackId, trackId),
            eq(simulatorTrackProgress.clerkUserId, clerkUserId),
          ),
        );
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async create(ctx: TenantContext, progress: SimulatorTrackProgress): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(simulatorTrackProgress).values({
        id: progress.id,
        trackId: progress.trackId,
        academyId: progress.academyId,
        clerkUserId: progress.clerkUserId,
        highestUnlockedPosition: progress.highestUnlockedPosition,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      }),
    );
  }

  async update(ctx: TenantContext, progress: SimulatorTrackProgress): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(simulatorTrackProgress)
        .set({
          highestUnlockedPosition: progress.highestUnlockedPosition,
          updatedAt: progress.updatedAt,
        })
        .where(eq(simulatorTrackProgress.id, progress.id)),
    );
  }
}
