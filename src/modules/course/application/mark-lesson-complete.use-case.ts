import type { TenantContext } from '@/shared/kernel/tenant-context';
import { LessonProgress } from '../domain/lesson-progress.entity';
import type { EnrollmentRepository } from '../domain/ports/enrollment.repository';
import type { LessonProgressRepository } from '../domain/ports/lesson-progress.repository';
import type { ProgressQuery } from '../domain/ports/progress-query';

export interface MarkLessonCompleteInput {
  /** Caller-supplied UUID for the lesson-progress record. */
  id: string;
  enrollmentId: string;
  lessonId: string;
  academyId: string;
}

/**
 * MarkLessonCompleteUseCase
 *
 * Marks a lesson as complete for an enrollment. Idempotent: re-marking a
 * lesson that is already completed is a no-op (onConflictDoNothing in the repo).
 *
 * After upserting the progress row, computes the course completion percentage.
 * If it reaches 100 %, sets enrollment.completedAt (only if not already set).
 *
 * No role guard — learners drive their own progress.
 */
export class MarkLessonCompleteUseCase {
  constructor(
    private readonly lessonProgressRepo: LessonProgressRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly progressQuery: ProgressQuery,
  ) {}

  async execute(ctx: TenantContext, input: MarkLessonCompleteInput): Promise<void> {
    const enrollment = await this.enrollmentRepo.findById(ctx, input.enrollmentId);
    if (!enrollment) throw new Error(`Enrollment "${input.enrollmentId}" not found`);

    const progress = new LessonProgress({
      id: input.id,
      enrollmentId: input.enrollmentId,
      lessonId: input.lessonId,
      academyId: input.academyId,
      completedAt: new Date(),
    });

    await this.lessonProgressRepo.upsert(ctx, progress);

    const courseProgress = await this.progressQuery.getCourseProgress(
      ctx,
      input.enrollmentId,
      enrollment.courseId,
    );

    if (courseProgress.percentComplete >= 100 && !enrollment.isCompleted) {
      const completed = enrollment.complete();
      await this.enrollmentRepo.update(ctx, completed);
    }
  }
}
