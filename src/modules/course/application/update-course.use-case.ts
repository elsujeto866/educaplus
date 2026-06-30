import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Course } from '../domain/course.entity';
import { SlugConflictError } from '../domain/errors';
import type { CourseRepository } from '../domain/ports/course.repository';

export interface UpdateCourseInput {
  id: string;
  title?: string;
  description?: string | null;
}

/**
 * UpdateCourseUseCase
 *
 * Updates title and/or description of an existing course. When the title
 * changes, re-derives the slug and validates uniqueness.
 *
 * Authorization: admin or instructor.
 */
export class UpdateCourseUseCase {
  constructor(private readonly courseRepo: CourseRepository) {}

  async execute(ctx: TenantContext, input: UpdateCourseInput): Promise<Course> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.courseRepo.findById(ctx, input.id);
    if (!existing) throw new Error(`Course "${input.id}" not found`);

    let slug = existing.slug;
    if (input.title !== undefined && input.title !== existing.title) {
      slug = Course.slugFromTitle(input.title);
      const conflict = await this.courseRepo.existsBySlug(
        ctx,
        existing.academyId,
        slug,
      );
      if (conflict) throw new SlugConflictError(slug, existing.academyId);
    }

    const updated = new Course({
      ...existing,
      slug,
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      updatedAt: new Date(),
    });

    await this.courseRepo.update(ctx, updated);
    return updated;
  }
}
