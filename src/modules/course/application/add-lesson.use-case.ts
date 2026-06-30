import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Lesson } from '../domain/lesson.entity';
import type { LessonRepository } from '../domain/ports/lesson.repository';
import type { LessonContent } from '../domain/value-objects/lesson-content.vo';
import type { LessonType } from '../domain/value-objects/lesson-type.vo';

export interface AddLessonInput {
  /** Caller-supplied UUID for the new lesson. */
  id: string;
  moduleId: string;
  academyId: string;
  type: LessonType;
  title: string;
  /** Content payload — must match type discriminant. */
  content: LessonContent;
}

/**
 * AddLessonUseCase
 *
 * Creates a new lesson at position = count + 1. The repository handles
 * the CTI atomic write (base row + companion) inside a single transaction.
 *
 * Authorization: admin or instructor.
 */
export class AddLessonUseCase {
  constructor(private readonly lessonRepo: LessonRepository) {}

  async execute(ctx: TenantContext, input: AddLessonInput): Promise<Lesson> {
    assertRole(ctx, ['admin', 'instructor']);

    const count = await this.lessonRepo.countByModule(ctx, input.moduleId);

    const now = new Date();
    const lesson = new Lesson({
      id: input.id,
      moduleId: input.moduleId,
      academyId: input.academyId,
      type: input.type,
      title: input.title,
      position: count + 1,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    });

    await this.lessonRepo.create(ctx, lesson);
    return lesson;
  }
}
