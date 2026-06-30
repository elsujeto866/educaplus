import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Course } from '../domain/course.entity';
import type { CourseRepository } from '../domain/ports/course.repository';

export interface PublishCourseInput {
  id: string;
}

/**
 * PublishCourseUseCase
 *
 * Sets course status to 'published' and records publishedAt timestamp.
 * Uses the immutable Course.publish() method which returns a new instance.
 *
 * Authorization: admin or instructor.
 */
export class PublishCourseUseCase {
  constructor(private readonly courseRepo: CourseRepository) {}

  async execute(ctx: TenantContext, input: PublishCourseInput): Promise<Course> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.courseRepo.findById(ctx, input.id);
    if (!existing) throw new Error(`Course "${input.id}" not found`);

    const published = existing.publish();
    await this.courseRepo.update(ctx, published);
    return published;
  }
}
