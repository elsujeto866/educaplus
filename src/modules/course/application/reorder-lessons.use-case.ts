import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { InvalidReorderError } from '../domain/errors';
import type { LessonRepository } from '../domain/ports/lesson.repository';

export interface ReorderLessonsInput {
  moduleId: string;
  /** Full ordered list of lesson IDs — must all belong to the module. */
  orderedIds: string[];
}

/**
 * ReorderLessonsUseCase
 *
 * Validates that every ID in orderedIds belongs to the module, then rewrites
 * all positions atomically in a single withTenant transaction (via repo.reorder).
 *
 * Rejects foreign IDs with InvalidReorderError before touching the DB.
 *
 * Authorization: admin or instructor.
 */
export class ReorderLessonsUseCase {
  constructor(private readonly lessonRepo: LessonRepository) {}

  async execute(ctx: TenantContext, input: ReorderLessonsInput): Promise<void> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.lessonRepo.findByModule(ctx, input.moduleId);
    const validIds = new Set(existing.map((l) => l.id));

    for (const id of input.orderedIds) {
      if (!validIds.has(id)) {
        throw new InvalidReorderError(id, input.moduleId);
      }
    }

    await this.lessonRepo.reorder(ctx, input.moduleId, input.orderedIds);
  }
}
