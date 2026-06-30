import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { LessonProgress } from '../lesson-progress.entity';

/**
 * Port: LessonProgressRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * The unique constraint (enrollment_id, lesson_id) makes upsert idempotent:
 * re-marking a completed lesson is a safe no-op via onConflictDoNothing.
 */
export interface LessonProgressRepository {
  /**
   * Idempotent upsert on (enrollment_id, lesson_id).
   * Re-marking an already-completed lesson does nothing.
   */
  upsert(ctx: TenantContext, progress: LessonProgress): Promise<void>;

  /** Returns all progress records for an enrollment — used to derive completion %. */
  findByEnrollment(ctx: TenantContext, enrollmentId: string): Promise<LessonProgress[]>;

  findByEnrollmentAndLesson(
    ctx: TenantContext,
    enrollmentId: string,
    lessonId: string,
  ): Promise<LessonProgress | null>;
}
