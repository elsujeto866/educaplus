import { eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { assessments } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Assessment } from '../domain/assessment.entity';
import type { AssessmentRepository } from '../domain/ports/assessment.repository';
import type { QuizQuestion } from '../domain/value-objects/quiz-question.vo';

/**
 * Maps a raw DB row to an Assessment entity.
 *
 * `questions` round-trips as typed JSONB. It is trusted on read without
 * re-validating through QuizQuestionFactory because every write already
 * passed the factory in the use-case layer (same trust model as
 * lesson_text_contents.body).
 */
function toEntity(row: typeof assessments.$inferSelect): Assessment {
  return new Assessment({
    id: row.id,
    courseId: row.courseId,
    academyId: row.academyId,
    title: row.title,
    questions: row.questions as unknown as QuizQuestion[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of AssessmentRepository.
 *
 * Upsert targets the unique courseId column — each course has at most one
 * assessment (the final quiz). Create-or-replace semantics.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 */
export class DrizzleAssessmentRepository implements AssessmentRepository {
  async upsert(ctx: TenantContext, assessment: Assessment): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .insert(assessments)
        .values({
          id: assessment.id,
          courseId: assessment.courseId,
          academyId: assessment.academyId,
          title: assessment.title,
          questions: assessment.questions as unknown as Record<string, unknown>[],
          createdAt: assessment.createdAt,
          updatedAt: assessment.updatedAt,
        })
        .onConflictDoUpdate({
          target: assessments.courseId,
          set: {
            title: assessment.title,
            questions: assessment.questions as unknown as Record<string, unknown>[],
            updatedAt: assessment.updatedAt,
          },
        }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<Assessment | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(assessments)
        .where(eq(assessments.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByCourse(ctx: TenantContext, courseId: string): Promise<Assessment | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(assessments)
        .where(eq(assessments.courseId, courseId));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.delete(assessments).where(eq(assessments.id, id)),
    );
  }
}
