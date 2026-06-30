import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { InvalidReorderError } from '../domain/errors';
import type { CourseModuleRepository } from '../domain/ports/course-module.repository';

export { InvalidReorderError };

export interface ReorderModulesInput {
  courseId: string;
  /** Full ordered list of module IDs — must contain every module in the course. */
  orderedIds: string[];
}

/**
 * ReorderModulesUseCase
 *
 * Validates that every ID in orderedIds belongs to the course, then rewrites
 * all positions atomically in a single withTenant transaction (via repo.reorder).
 *
 * Rejects foreign IDs with InvalidReorderError before touching the DB.
 *
 * Authorization: admin or instructor.
 */
export class ReorderModulesUseCase {
  constructor(private readonly moduleRepo: CourseModuleRepository) {}

  async execute(ctx: TenantContext, input: ReorderModulesInput): Promise<void> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.moduleRepo.findByCourse(ctx, input.courseId);
    const validIds = new Set(existing.map((m) => m.id));

    for (const id of input.orderedIds) {
      if (!validIds.has(id)) {
        throw new InvalidReorderError(id, input.courseId);
      }
    }

    await this.moduleRepo.reorder(ctx, input.courseId, input.orderedIds);
  }
}
