import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Course } from '../domain/course.entity';
import type { CourseRepository } from '../domain/ports/course.repository';

export interface UnpublishCourseInput {
  id: string;
}

/**
 * UnpublishCourseUseCase
 *
 * Sets course status back to 'draft' and clears publishedAt.
 * Uses the immutable Course.unpublish() method which returns a new instance.
 *
 * Authorization: admin or instructor.
 */
export class UnpublishCourseUseCase {
  constructor(private readonly courseRepo: CourseRepository) {}

  async execute(ctx: TenantContext, input: UnpublishCourseInput): Promise<Course> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.courseRepo.findById(ctx, input.id);
    if (!existing) throw new Error(`Course "${input.id}" not found`);

    const unpublished = existing.unpublish();
    await this.courseRepo.update(ctx, unpublished);
    return unpublished;
  }
}
