import { and, desc, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { simulators } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Simulator, type SelectionStrategy } from '../domain/simulator.entity';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/**
 * Maps a raw DB row to a Simulator entity. `topicFilter` is stored as JSONB
 * — Drizzle's `$inferSelect` types it as `unknown`, so it's cast to the
 * flat `string[] | null` shape Decision 1 defines (never anything else is
 * ever written to that column, all writes go through `toRow` below).
 */
function toEntity(row: typeof simulators.$inferSelect): Simulator {
  return new Simulator({
    id: row.id,
    academyId: row.academyId,
    bankId: row.bankId,
    title: row.title,
    description: row.description,
    questionCount: row.questionCount,
    passingScore: row.passingScore,
    timeLimitMinutes: row.timeLimitMinutes,
    attemptLimit: row.attemptLimit,
    selectionStrategy: row.selectionStrategy as SelectionStrategy,
    topicFilter: row.topicFilter as string[] | null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of SimulatorRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * Mirrors `DrizzleCourseRepository`/`DrizzleQuestionBankRepository`.
 */
export class DrizzleSimulatorRepository implements SimulatorRepository {
  async create(ctx: TenantContext, simulator: Simulator): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(simulators).values({
        id: simulator.id,
        academyId: simulator.academyId,
        bankId: simulator.bankId,
        title: simulator.title,
        description: simulator.description,
        questionCount: simulator.questionCount,
        passingScore: simulator.passingScore,
        timeLimitMinutes: simulator.timeLimitMinutes,
        attemptLimit: simulator.attemptLimit,
        selectionStrategy: simulator.selectionStrategy,
        topicFilter: simulator.topicFilter,
        status: simulator.status,
        createdAt: simulator.createdAt,
        updatedAt: simulator.updatedAt,
      }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<Simulator | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(simulators).where(eq(simulators.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByAcademy(ctx: TenantContext, academyId: string): Promise<Simulator[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(simulators)
        .where(eq(simulators.academyId, academyId))
        .orderBy(desc(simulators.createdAt));
      return rows.map(toEntity);
    });
  }

  async findPublishedByAcademy(ctx: TenantContext, academyId: string): Promise<Simulator[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(simulators)
        .where(and(eq(simulators.academyId, academyId), eq(simulators.status, 'published')))
        .orderBy(desc(simulators.createdAt));
      return rows.map(toEntity);
    });
  }

  async update(ctx: TenantContext, simulator: Simulator): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(simulators)
        .set({
          title: simulator.title,
          description: simulator.description,
          questionCount: simulator.questionCount,
          passingScore: simulator.passingScore,
          timeLimitMinutes: simulator.timeLimitMinutes,
          attemptLimit: simulator.attemptLimit,
          selectionStrategy: simulator.selectionStrategy,
          topicFilter: simulator.topicFilter,
          status: simulator.status,
          updatedAt: simulator.updatedAt,
        })
        .where(eq(simulators.id, simulator.id)),
    );
  }
}
