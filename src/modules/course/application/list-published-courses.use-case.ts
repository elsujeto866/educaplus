import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Course } from '../domain/course.entity';
import type { CourseRepository } from '../domain/ports/course.repository';

/**
 * ListPublishedCoursesUseCase — reads the tenant-scoped published course catalog.
 *
 * Read-only: no `assertRole` guard — any authenticated tenant member (including
 * unenrolled learners) may browse the catalog. Page-level gating decides who
 * reaches this use-case. Filters to `status = 'published'` in SQL via
 * findPublishedByAcademy to avoid loading drafts into memory.
 */
export class ListPublishedCoursesUseCase {
  constructor(private readonly courseRepo: CourseRepository) {}

  async execute(ctx: TenantContext): Promise<Course[]> {
    return this.courseRepo.findPublishedByAcademy(ctx, ctx.orgId);
  }
}
