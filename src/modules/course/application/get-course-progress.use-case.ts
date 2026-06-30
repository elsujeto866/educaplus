import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { CourseProgress } from '../domain/ports/progress-query';
import type { ProgressQuery } from '../domain/ports/progress-query';

export interface GetCourseProgressInput {
  enrollmentId: string;
  courseId: string;
}

/**
 * GetCourseProgressUseCase
 *
 * Returns the derived course completion snapshot for an enrollment.
 * Delegates to ProgressQuery which runs COUNT aggregates in a tenant-scoped tx.
 *
 * No role guard — both learners and instructors may query progress.
 */
export class GetCourseProgressUseCase {
  constructor(private readonly progressQuery: ProgressQuery) {}

  async execute(
    ctx: TenantContext,
    input: GetCourseProgressInput,
  ): Promise<CourseProgress> {
    return this.progressQuery.getCourseProgress(
      ctx,
      input.enrollmentId,
      input.courseId,
    );
  }
}
