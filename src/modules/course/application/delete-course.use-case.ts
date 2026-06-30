import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { CourseRepository } from '../domain/ports/course.repository';

export interface DeleteCourseInput {
  id: string;
}

/**
 * DeleteCourseUseCase
 *
 * Hard-deletes a course. All child records (modules, lessons, enrollments, etc.)
 * are removed via CASCADE constraints in the DB schema.
 *
 * Authorization: admin or instructor.
 */
export class DeleteCourseUseCase {
  constructor(private readonly courseRepo: CourseRepository) {}

  async execute(ctx: TenantContext, input: DeleteCourseInput): Promise<void> {
    assertRole(ctx, ['admin', 'instructor']);
    await this.courseRepo.delete(ctx, input.id);
  }
}
