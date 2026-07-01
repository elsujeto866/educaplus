/**
 * GetCourseDetailUseCase unit tests.
 *
 * Mocked CourseRepository / CourseModuleRepository / LessonRepository — no DB.
 * Covers: ordered modules + ordered lesson summaries per module, and the
 * not-found / cross-tenant scenario (repo already returns null under RLS
 * scoping — the use-case must propagate that as null, not throw or leak).
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetCourseDetailUseCase } from '../../../src/modules/course/application/get-course-detail.use-case';
import { Course } from '../../../src/modules/course/domain/course.entity';
import { CourseModule } from '../../../src/modules/course/domain/course-module.entity';
import { Lesson } from '../../../src/modules/course/domain/lesson.entity';
import type { CourseRepository } from '../../../src/modules/course/domain/ports/course.repository';
import type { CourseModuleRepository } from '../../../src/modules/course/domain/ports/course-module.repository';
import type { LessonRepository } from '../../../src/modules/course/domain/ports/lesson.repository';

const now = new Date('2025-01-01T00:00:00Z');
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };

function makeCourse(overrides: Partial<ConstructorParameters<typeof Course>[0]> = {}): Course {
  return new Course({
    id: 'course-1',
    academyId: 'org_A',
    slug: 'intro-to-ts',
    title: 'Intro to TypeScript',
    description: null,
    status: 'draft',
    position: 1,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeModule(overrides: Partial<ConstructorParameters<typeof CourseModule>[0]> = {}): CourseModule {
  return new CourseModule({
    id: 'mod-1',
    courseId: 'course-1',
    academyId: 'org_A',
    title: 'Module 1',
    description: null,
    position: 1,
    assessmentId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeTextLesson(overrides: Partial<ConstructorParameters<typeof Lesson>[0]> = {}): Lesson {
  return new Lesson({
    id: 'lesson-1',
    moduleId: 'mod-1',
    academyId: 'org_A',
    type: 'text',
    title: 'Lesson 1',
    position: 1,
    content: { type: 'text', body: {} },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeRepos(overrides: {
  courseRepo?: Partial<CourseRepository>;
  moduleRepo?: Partial<CourseModuleRepository>;
  lessonRepo?: Partial<LessonRepository>;
} = {}): {
  courseRepo: CourseRepository;
  moduleRepo: CourseModuleRepository;
  lessonRepo: LessonRepository;
} {
  return {
    courseRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByAcademy: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsBySlug: vi.fn(),
      maxPositionByAcademy: vi.fn(),
      ...overrides.courseRepo,
    },
    moduleRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      findByCourse: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
      countByCourse: vi.fn(),
      reorder: vi.fn(),
      ...overrides.moduleRepo,
    },
    lessonRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      findByModule: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
      countByModule: vi.fn(),
      reorder: vi.fn(),
      ...overrides.lessonRepo,
    },
  };
}

describe('GetCourseDetailUseCase', () => {
  it('returns the course with modules and lesson summaries ordered by position', async () => {
    const course = makeCourse();
    const mod1 = makeModule({ id: 'mod-1', title: 'Module A', position: 1 });
    const mod2 = makeModule({ id: 'mod-2', title: 'Module B', position: 2 });

    const mod1Lessons = [
      makeTextLesson({ id: 'l1', moduleId: 'mod-1', title: 'L1', position: 1 }),
      makeTextLesson({ id: 'l2', moduleId: 'mod-1', title: 'L2', position: 2 }),
    ];
    const mod2Lessons = [
      makeTextLesson({ id: 'l3', moduleId: 'mod-2', title: 'L3', position: 1 }),
    ];

    const { courseRepo, moduleRepo, lessonRepo } = makeRepos({
      courseRepo: { findById: vi.fn().mockResolvedValue(course) },
      moduleRepo: { findByCourse: vi.fn().mockResolvedValue([mod1, mod2]) },
      lessonRepo: {
        findByModule: vi
          .fn()
          .mockImplementation((_ctx: TenantContext, moduleId: string) =>
            Promise.resolve(moduleId === 'mod-1' ? mod1Lessons : mod2Lessons),
          ),
      },
    });

    const useCase = new GetCourseDetailUseCase(courseRepo, moduleRepo, lessonRepo);
    const detail = await useCase.execute(instructorCtx, 'course-1');

    expect(detail).not.toBeNull();
    expect(detail?.course.id).toBe('course-1');
    expect(detail?.modules.map((m) => m.id)).toEqual(['mod-1', 'mod-2']);
    expect(detail?.modules[0]?.lessons.map((l) => l.id)).toEqual(['l1', 'l2']);
    expect(detail?.modules[0]?.lessons[0]).toMatchObject({
      id: 'l1',
      title: 'L1',
      type: 'text',
      position: 1,
    });
    expect(detail?.modules[1]?.lessons.map((l) => l.id)).toEqual(['l3']);
  });

  it('returns null for a nonexistent or cross-tenant course (no data leak)', async () => {
    const { courseRepo, moduleRepo, lessonRepo } = makeRepos({
      courseRepo: { findById: vi.fn().mockResolvedValue(null) },
    });

    const useCase = new GetCourseDetailUseCase(courseRepo, moduleRepo, lessonRepo);
    const detail = await useCase.execute(instructorCtx, 'course-does-not-exist');

    expect(detail).toBeNull();
    expect(moduleRepo.findByCourse).not.toHaveBeenCalled();
  });
});
