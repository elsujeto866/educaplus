import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Course } from '../domain/course.entity';
import type { CourseRepository } from '../domain/ports/course.repository';

/**
 * ListCoursesUseCase — reads the tenant-scoped course list.
 *
 * Read-only: no `assertRole` guard — page-level gating (requireInstructor)
 * decides who may reach this use-case. Mirrors GetAcademyUseCase.
 */
export class ListCoursesUseCase {
  constructor(private readonly courseRepo: CourseRepository) {}

  async execute(ctx: TenantContext): Promise<Course[]> {
    return this.courseRepo.findByAcademy(ctx, ctx.orgId);
  }
}
