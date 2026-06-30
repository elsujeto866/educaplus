import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Lesson } from '../domain/lesson.entity';
import type { LessonRepository } from '../domain/ports/lesson.repository';
import type { LessonContent } from '../domain/value-objects/lesson-content.vo';

export interface UpdateLessonBodyInput {
  lessonId: string;
  /** Updated content payload — must match the lesson's existing type. */
  content: LessonContent;
}

/**
 * UpdateLessonBodyUseCase
 *
 * Updates the content payload (body/metadata) of an existing lesson.
 * The content.type must match the lesson's type — the Lesson constructor
 * enforces this invariant.
 *
 * Atomically updates base row + companion row via LessonRepository.update().
 *
 * Authorization: admin or instructor.
 */
export class UpdateLessonBodyUseCase {
  constructor(private readonly lessonRepo: LessonRepository) {}

  async execute(ctx: TenantContext, input: UpdateLessonBodyInput): Promise<Lesson> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.lessonRepo.findById(ctx, input.lessonId);
    if (!existing) throw new Error(`Lesson "${input.lessonId}" not found`);

    const updated = new Lesson({
      ...existing,
      content: input.content,
      updatedAt: new Date(),
    });

    await this.lessonRepo.update(ctx, updated);
    return updated;
  }
}
