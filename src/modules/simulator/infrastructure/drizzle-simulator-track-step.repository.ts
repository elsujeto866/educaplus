import { and, asc, count, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import type { TenantTx } from '@/shared/infrastructure/db/with-tenant';
import { simulatorTrackSteps } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrackStep } from '../domain/simulator-track-step.entity';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';

/**
 * Maps a raw DB row to a SimulatorTrackStep entity.
 */
function toEntity(row: typeof simulatorTrackSteps.$inferSelect): SimulatorTrackStep {
  return new SimulatorTrackStep({
    id: row.id,
    trackId: row.trackId,
    academyId: row.academyId,
    simulatorId: row.simulatorId,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of SimulatorTrackStepRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * unique(simulator_id) and unique(track_id, position) back `create` — a
 * concurrent/duplicate insert surfaces as a Postgres unique-violation
 * (SQLSTATE 23505), propagated unmodified to the caller
 * (`AddSimulatorToTrackStepUseCase` maps it to `SimulatorAlreadyInTrackError`).
 * Mirrors `DrizzleQuestionRepository`'s count-then-append-position convention.
 */
export class DrizzleSimulatorTrackStepRepository implements SimulatorTrackStepRepository {
  async create(ctx: TenantContext, step: SimulatorTrackStep): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(simulatorTrackSteps).values({
        id: step.id,
        trackId: step.trackId,
        academyId: step.academyId,
        simulatorId: step.simulatorId,
        position: step.position,
        createdAt: step.createdAt,
        updatedAt: step.updatedAt,
      }),
    );
  }

  async findByTrack(ctx: TenantContext, trackId: string): Promise<SimulatorTrackStep[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(simulatorTrackSteps)
        .where(eq(simulatorTrackSteps.trackId, trackId))
        .orderBy(asc(simulatorTrackSteps.position));
      return rows.map(toEntity);
    });
  }

  async findBySimulator(ctx: TenantContext, simulatorId: string): Promise<SimulatorTrackStep | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(simulatorTrackSteps)
        .where(eq(simulatorTrackSteps.simulatorId, simulatorId));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async countByTrack(ctx: TenantContext, trackId: string): Promise<number> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ n: count() })
        .from(simulatorTrackSteps)
        .where(and(eq(simulatorTrackSteps.trackId, trackId)));
      return result?.n ?? 0;
    });
  }

  async deleteById(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) => tx.delete(simulatorTrackSteps).where(eq(simulatorTrackSteps.id, id)));
  }

  async replacePositions(ctx: TenantContext, updates: { id: string; position: number }[]): Promise<void> {
    await withTenant(ctx, async (tx) => {
      await recompactPositions(tx, updates);
    });
  }

  async removeAndRecompact(
    ctx: TenantContext,
    stepId: string,
    updates: { id: string; position: number }[],
  ): Promise<void> {
    // ONE withTenant transaction (one db.transaction) for both the delete
    // and the position re-compaction — a failure between them would
    // otherwise (across two separate transactions) leave a position gap.
    await withTenant(ctx, async (tx) => {
      await tx.delete(simulatorTrackSteps).where(eq(simulatorTrackSteps.id, stepId));
      await recompactPositions(tx, updates);
    });
  }
}

/**
 * Two-phase write: `unique(track_id, position)` is NOT deferrable, so
 * applying final positions directly (one UPDATE per row) can collide
 * mid-transaction on a swap/shift (e.g. [a:1,b:2] -> [a:2,b:1] tries to set
 * a=2 while b still holds 2). Phase 1 parks every touched row at a unique
 * negative placeholder (never colliding with the >=1 positions of untouched
 * steps); phase 2 applies the real final positions, which by then are all
 * vacated. Shared by `replacePositions` (reorder) and `removeAndRecompact`
 * (remove) — both run this against the SAME transaction handle as their
 * other statement(s), so it never opens a transaction of its own.
 */
async function recompactPositions(
  tx: TenantTx,
  updates: { id: string; position: number }[],
): Promise<void> {
  for (const [index, update] of updates.entries()) {
    await tx
      .update(simulatorTrackSteps)
      .set({ position: -(index + 1) })
      .where(eq(simulatorTrackSteps.id, update.id));
  }
  for (const update of updates) {
    await tx
      .update(simulatorTrackSteps)
      .set({ position: update.position, updatedAt: new Date() })
      .where(eq(simulatorTrackSteps.id, update.id));
  }
}
