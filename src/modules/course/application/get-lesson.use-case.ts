import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Lesson } from '../domain/lesson.entity';
import type { LessonRepository } from '../domain/ports/lesson.repository';

/**
 * GetLessonUseCase — reads a single lesson with full content (incl. body /
 * external URL) for the authoring editor.
 *
 * Read-only: no `assertRole` guard — page-level gating decides who may reach
 * this use-case. Reuses the existing LessonRepository.findById (already
 * RLS/ctx-scoped) — no new repository method needed.
 */
export class GetLessonUseCase {
  constructor(private readonly lessonRepo: LessonRepository) {}

  async execute(ctx: TenantContext, lessonId: string): Promise<Lesson | null> {
    return this.lessonRepo.findById(ctx, lessonId);
  }
}
