import { and, eq, sql } from 'drizzle-orm';
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
 * Drizzle implementation of SimulatorTrackProgressRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 *
 * `upsertAdvance` is a SINGLE `INSERT ... ON CONFLICT (track_id,
 * clerk_user_id) DO UPDATE` targeting the `unique(track_id, clerk_user_id)`
 * constraint, setting `highest_unlocked_position` to
 * `GREATEST(existing, incoming)`. This is race-safe by construction: two
 * overlapping calls (e.g. concurrent lazy-reconciliation reads racing each
 * other) can never leave the row at a LOWER value than either call applied,
 * because Postgres evaluates GREATEST against the row as it exists AT
 * COMMIT time of each individual statement, not a value read earlier in a
 * read-compute-write cycle. This replaces a previous create/update/23505
 * pair that had a lost-update window: a blind id-keyed UPDATE has no
 * monotonic guard, so a stale write applied after a newer one could
 * silently regress the persisted frontier.
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

  async upsertAdvance(
    ctx: TenantContext,
    progress: SimulatorTrackProgress,
  ): Promise<SimulatorTrackProgress> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .insert(simulatorTrackProgress)
        .values({
          id: progress.id,
          trackId: progress.trackId,
          academyId: progress.academyId,
          clerkUserId: progress.clerkUserId,
          highestUnlockedPosition: progress.highestUnlockedPosition,
          createdAt: progress.createdAt,
          updatedAt: progress.updatedAt,
        })
        .onConflictDoUpdate({
          target: [simulatorTrackProgress.trackId, simulatorTrackProgress.clerkUserId],
          set: {
            highestUnlockedPosition: sql`GREATEST(${simulatorTrackProgress.highestUnlockedPosition}, excluded.highest_unlocked_position)`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
        .returning();
      // rows[0] is guaranteed — INSERT ... ON CONFLICT DO UPDATE ... RETURNING
      // always yields exactly one row (either the new insert or the updated
      // conflicting row), never zero.
      return toEntity(rows[0]!);
    });
  }
}
