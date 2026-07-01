import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { CourseModule } from '../domain/course-module.entity';
import type { CourseModuleRepository } from '../domain/ports/course-module.repository';

export interface AddModuleInput {
  /** Caller-supplied UUID for the new module. */
  id: string;
  courseId: string;
  academyId: string;
  title: string;
  description?: string | null;
}

/**
 * AddModuleUseCase
 *
 * Appends a new CourseModule at position = count + 1.
 *
 * Authorization: admin or instructor.
 */
export class AddModuleUseCase {
  constructor(private readonly moduleRepo: CourseModuleRepository) {}

  async execute(ctx: TenantContext, input: AddModuleInput): Promise<CourseModule> {
    assertRole(ctx, ['admin', 'instructor']);

    const count = await this.moduleRepo.countByCourse(ctx, input.courseId);

    const now = new Date();
    const courseModule = new CourseModule({
      id: input.id,
      courseId: input.courseId,
      academyId: input.academyId,
      title: input.title,
      description: input.description ?? null,
      position: count + 1,
      createdAt: now,
      updatedAt: now,
    });

    await this.moduleRepo.create(ctx, courseModule);
    return courseModule;
  }
}
