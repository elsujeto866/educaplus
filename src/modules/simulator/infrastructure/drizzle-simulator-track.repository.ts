import { desc, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { simulatorTracks } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrack } from '../domain/simulator-track.entity';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';

/**
 * Maps a raw DB row to a SimulatorTrack entity.
 */
function toEntity(row: typeof simulatorTracks.$inferSelect): SimulatorTrack {
  return new SimulatorTrack({
    id: row.id,
    academyId: row.academyId,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of SimulatorTrackRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * Mirrors `DrizzleSimulatorRepository`.
 */
export class DrizzleSimulatorTrackRepository implements SimulatorTrackRepository {
  async create(ctx: TenantContext, track: SimulatorTrack): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(simulatorTracks).values({
        id: track.id,
        academyId: track.academyId,
        title: track.title,
        description: track.description,
        status: track.status,
        createdAt: track.createdAt,
        updatedAt: track.updatedAt,
      }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<SimulatorTrack | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(simulatorTracks).where(eq(simulatorTracks.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByAcademy(ctx: TenantContext, academyId: string): Promise<SimulatorTrack[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(simulatorTracks)
        .where(eq(simulatorTracks.academyId, academyId))
        .orderBy(desc(simulatorTracks.createdAt));
      return rows.map(toEntity);
    });
  }

  async update(ctx: TenantContext, track: SimulatorTrack): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(simulatorTracks)
        .set({
          title: track.title,
          description: track.description,
          status: track.status,
          updatedAt: track.updatedAt,
        })
        .where(eq(simulatorTracks.id, track.id)),
    );
  }
}
