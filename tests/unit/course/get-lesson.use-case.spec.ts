/**
 * GetLessonUseCase unit tests.
 *
 * Mocked LessonRepository — no DB. Editor prefill use-case: read-only,
 * no assertRole, returns the full Lesson (content/body incl. external URL).
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetLessonUseCase } from '../../../src/modules/course/application/get-lesson.use-case';
import { Lesson } from '../../../src/modules/course/domain/lesson.entity';
import type { LessonRepository } from '../../../src/modules/course/domain/ports/lesson.repository';

const now = new Date('2025-01-01T00:00:00Z');
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };

function makeLessonRepo(overrides: Partial<LessonRepository> = {}): LessonRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByModule: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countByModule: vi.fn(),
    reorder: vi.fn(),
    ...overrides,
  };
}

describe('GetLessonUseCase', () => {
  it('returns the full lesson including external video URL for the editor', async () => {
    const videoLesson = new Lesson({
      id: 'lesson-1',
      moduleId: 'mod-1',
      academyId: 'org_A',
      type: 'video',
      title: 'External Video Lesson',
      position: 1,
      content: {
        type: 'video',
        cloudflareUid: null,
        durationSeconds: null,
        thumbnailUrl: null,
        externalUrl: 'https://youtube.com/watch?v=abc123',
      },
      createdAt: now,
      updatedAt: now,
    });
    const lessonRepo = makeLessonRepo({ findById: vi.fn().mockResolvedValue(videoLesson) });
    const useCase = new GetLessonUseCase(lessonRepo);

    const result = await useCase.execute(instructorCtx, 'lesson-1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('lesson-1');
    expect(result?.content).toMatchObject({
      type: 'video',
      externalUrl: 'https://youtube.com/watch?v=abc123',
    });
    expect(lessonRepo.findById).toHaveBeenCalledWith(instructorCtx, 'lesson-1');
  });

  it('returns null when the lesson does not exist or belongs to another tenant', async () => {
    const lessonRepo = makeLessonRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new GetLessonUseCase(lessonRepo);

    const result = await useCase.execute(instructorCtx, 'lesson-missing');

    expect(result).toBeNull();
  });
});
