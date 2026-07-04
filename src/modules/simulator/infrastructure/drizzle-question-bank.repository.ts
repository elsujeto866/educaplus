import { and, count, desc, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { questionBanks, simulators } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { QuestionBank } from '../domain/question-bank.entity';
import type { QuestionBankRepository } from '../domain/ports/question-bank.repository';

/**
 * Maps a raw DB row to a QuestionBank entity.
 */
function toEntity(row: typeof questionBanks.$inferSelect): QuestionBank {
  return new QuestionBank({
    id: row.id,
    academyId: row.academyId,
    title: row.title,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of QuestionBankRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * Mirrors `DrizzleCourseRepository`.
 */
export class DrizzleQuestionBankRepository implements QuestionBankRepository {
  async create(ctx: TenantContext, bank: QuestionBank): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(questionBanks).values({
        id: bank.id,
        academyId: bank.academyId,
        title: bank.title,
        description: bank.description,
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
      }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<QuestionBank | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(questionBanks).where(eq(questionBanks.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByAcademy(ctx: TenantContext, academyId: string): Promise<QuestionBank[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(questionBanks)
        .where(eq(questionBanks.academyId, academyId))
        .orderBy(desc(questionBanks.createdAt));
      return rows.map(toEntity);
    });
  }

  async update(ctx: TenantContext, bank: QuestionBank): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(questionBanks)
        .set({
          title: bank.title,
          description: bank.description,
          updatedAt: bank.updatedAt,
        })
        .where(eq(questionBanks.id, bank.id)),
    );
  }

  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) => tx.delete(questionBanks).where(eq(questionBanks.id, id)));
  }

  async isReferencedBySimulator(ctx: TenantContext, bankId: string): Promise<boolean> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ n: count() })
        .from(simulators)
        .where(and(eq(simulators.bankId, bankId), eq(simulators.academyId, ctx.orgId)));
      return (result?.n ?? 0) > 0;
    });
  }
}
