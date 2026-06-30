import { and, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { lessonProgress } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { LessonProgress } from '../domain/lesson-progress.entity';
import type { LessonProgressRepository } from '../domain/ports/lesson-progress.repository';

/**
 * Drizzle implementation of LessonProgressRepository.
 *
 * Upsert uses onConflictDoNothing on the unique (enrollment_id, lesson_id)
 * constraint — re-marking a completed lesson is a safe no-op at the DB level.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 */
export class DrizzleLessonProgressRepository implements LessonProgressRepository {
  /**
   * Idempotent upsert on (enrollment_id, lesson_id).
   * If the row already exists the conflict is silently ignored.
   */
  async upsert(ctx: TenantContext, progress: LessonProgress): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .insert(lessonProgress)
        .values({
          id: progress.id,
          enrollmentId: progress.enrollmentId,
          lessonId: progress.lessonId,
          academyId: progress.academyId,
          completedAt: progress.completedAt,
        })
        .onConflictDoNothing(),
    );
  }

  async findByEnrollment(
    ctx: TenantContext,
    enrollmentId: string,
  ): Promise<LessonProgress[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.enrollmentId, enrollmentId));
      return rows.map(
        (row) =>
          new LessonProgress({
            id: row.id,
            enrollmentId: row.enrollmentId,
            lessonId: row.lessonId,
            academyId: row.academyId,
            completedAt: row.completedAt,
          }),
      );
    });
  }

  async findByEnrollmentAndLesson(
    ctx: TenantContext,
    enrollmentId: string,
    lessonId: string,
  ): Promise<LessonProgress | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollmentId),
            eq(lessonProgress.lessonId, lessonId),
          ),
        );
      const row = rows[0];
      if (!row) return null;
      return new LessonProgress({
        id: row.id,
        enrollmentId: row.enrollmentId,
        lessonId: row.lessonId,
        academyId: row.academyId,
        completedAt: row.completedAt,
      });
    });
  }
}
