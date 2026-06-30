import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Course } from '../domain/course.entity';
import { SlugConflictError } from '../domain/errors';
import type { CourseRepository } from '../domain/ports/course.repository';

export interface CreateCourseInput {
  /** Caller-supplied UUID for the new course. */
  id: string;
  academyId: string;
  title: string;
  description?: string | null;
}

/**
 * CreateCourseUseCase
 *
 * Derives a slug from the title, enforces slug uniqueness within the academy,
 * assigns position = max + 1, and persists the course in DRAFT status.
 *
 * Authorization: admin or instructor.
 */
export class CreateCourseUseCase {
  constructor(private readonly courseRepo: CourseRepository) {}

  async execute(ctx: TenantContext, input: CreateCourseInput): Promise<Course> {
    assertRole(ctx, ['admin', 'instructor']);

    const slug = Course.slugFromTitle(input.title);

    const exists = await this.courseRepo.existsBySlug(ctx, input.academyId, slug);
    if (exists) throw new SlugConflictError(slug, input.academyId);

    const maxPos = await this.courseRepo.maxPositionByAcademy(ctx, input.academyId);

    const now = new Date();
    const course = new Course({
      id: input.id,
      academyId: input.academyId,
      slug,
      title: input.title,
      description: input.description ?? null,
      status: 'draft',
      position: maxPos + 1,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.courseRepo.create(ctx, course);
    return course;
  }
}
