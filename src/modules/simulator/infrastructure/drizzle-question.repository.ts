import { and, asc, count, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { questions } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Question, type QuestionOption } from '../domain/question.entity';
import type { Difficulty } from '../domain/value-objects/difficulty.vo';
import type { QuestionRepository } from '../domain/ports/question.repository';

/**
 * Maps a raw DB row to a Question entity.
 */
function toEntity(row: typeof questions.$inferSelect): Question {
  return new Question({
    id: row.id,
    bankId: row.bankId,
    academyId: row.academyId,
    prompt: row.prompt,
    options: row.options as QuestionOption[],
    correctOptionId: row.correctOptionId,
    topic: row.topic,
    difficulty: row.difficulty as Difficulty | null,
    explanation: row.explanation,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of QuestionRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * Mirrors `DrizzleCourseModuleRepository`.
 */
export class DrizzleQuestionRepository implements QuestionRepository {
  async create(ctx: TenantContext, question: Question): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(questions).values({
        id: question.id,
        bankId: question.bankId,
        academyId: question.academyId,
        prompt: question.prompt,
        options: question.options,
        correctOptionId: question.correctOptionId,
        topic: question.topic,
        difficulty: question.difficulty,
        explanation: question.explanation,
        position: question.position,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<Question | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(questions).where(eq(questions.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByBank(ctx: TenantContext, bankId: string): Promise<Question[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(questions)
        .where(eq(questions.bankId, bankId))
        .orderBy(asc(questions.position));
      return rows.map(toEntity);
    });
  }

  async update(ctx: TenantContext, question: Question): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(questions)
        .set({
          prompt: question.prompt,
          options: question.options,
          correctOptionId: question.correctOptionId,
          topic: question.topic,
          difficulty: question.difficulty,
          explanation: question.explanation,
          position: question.position,
          updatedAt: question.updatedAt,
        })
        .where(eq(questions.id, question.id)),
    );
  }

  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) => tx.delete(questions).where(eq(questions.id, id)));
  }

  async countByBank(ctx: TenantContext, bankId: string): Promise<number> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ n: count() })
        .from(questions)
        .where(and(eq(questions.bankId, bankId)));
      return result?.n ?? 0;
    });
  }
}
