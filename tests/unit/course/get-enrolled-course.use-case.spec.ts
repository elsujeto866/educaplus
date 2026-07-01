/**
 * GetEnrolledCourseUseCase unit tests.
 *
 * Mocked CourseRepository / CourseModuleRepository / LessonRepository /
 * EnrollmentRepository / LessonProgressRepository / ProgressQuery — no DB.
 * Covers: not-found/cross-tenant course (null), not-enrolled overlay
 * (completed=false everywhere, progressPercent=0), and enrolled overlay
 * (completed lessons flagged from lessonProgressRepo.findByEnrollment,
 * progressPercent from progressQuery.getCourseProgress).
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetEnrolledCourseUseCase } from '../../../src/modules/course/application/get-enrolled-course.use-case';
import { Course } from '../../../src/modules/course/domain/course.entity';
import { CourseModule } from '../../../src/modules/course/domain/course-module.entity';
import { Lesson } from '../../../src/modules/course/domain/lesson.entity';
import { Enrollment } from '../../../src/modules/course/domain/enrollment.entity';
import { LessonProgress } from '../../../src/modules/course/domain/lesson-progress.entity';
import type { CourseRepository } from '../../../src/modules/course/domain/ports/course.repository';
import type { CourseModuleRepository } from '../../../src/modules/course/domain/ports/course-module.repository';
import type { LessonRepository } from '../../../src/modules/course/domain/ports/lesson.repository';
import type { EnrollmentRepository } from '../../../src/modules/course/domain/ports/enrollment.repository';
import type { LessonProgressRepository } from '../../../src/modules/course/domain/ports/lesson-progress.repository';
import type { ProgressQuery } from '../../../src/modules/course/domain/ports/progress-query';

const now = new Date('2025-01-01T00:00:00Z');
const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

function makeCourse(overrides: Partial<ConstructorParameters<typeof Course>[0]> = {}): Course {
  return new Course({
    id: 'course-1',
    academyId: 'org_A',
    slug: 'intro-to-ts',
    title: 'Intro to TypeScript',
    description: null,
    status: 'published',
    position: 1,
    publishedAt: now,
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

function makeEnrollment(overrides: Partial<ConstructorParameters<typeof Enrollment>[0]> = {}): Enrollment {
  return new Enrollment({
    id: 'enr-1',
    courseId: 'course-1',
    academyId: 'org_A',
    clerkUserId: 'user_3',
    enrolledAt: now,
    completedAt: null,
    ...overrides,
  });
}

function makeLessonProgress(overrides: Partial<ConstructorParameters<typeof LessonProgress>[0]> = {}): LessonProgress {
  return new LessonProgress({
    id: 'prog-1',
    enrollmentId: 'enr-1',
    lessonId: 'lesson-1',
    academyId: 'org_A',
    completedAt: now,
    ...overrides,
  });
}

function makeRepos(overrides: {
  courseRepo?: Partial<CourseRepository>;
  moduleRepo?: Partial<CourseModuleRepository>;
  lessonRepo?: Partial<LessonRepository>;
  enrollmentRepo?: Partial<EnrollmentRepository>;
  lessonProgressRepo?: Partial<LessonProgressRepository>;
  progressQuery?: Partial<ProgressQuery>;
} = {}): {
  courseRepo: CourseRepository;
  moduleRepo: CourseModuleRepository;
  lessonRepo: LessonRepository;
  enrollmentRepo: EnrollmentRepository;
  lessonProgressRepo: LessonProgressRepository;
  progressQuery: ProgressQuery;
} {
  return {
    courseRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByAcademy: vi.fn(),
      findPublishedByAcademy: vi.fn(),
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
    enrollmentRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      findByCourseAndUser: vi.fn().mockResolvedValue(null),
      findByCourse: vi.fn(),
      findByLearner: vi.fn(),
      update: vi.fn(),
      existsByCourseAndUser: vi.fn(),
      ...overrides.enrollmentRepo,
    },
    lessonProgressRepo: {
      upsert: vi.fn(),
      findByEnrollment: vi.fn().mockResolvedValue([]),
      findByEnrollmentAndLesson: vi.fn(),
      ...overrides.lessonProgressRepo,
    },
    progressQuery: {
      getCourseProgress: vi.fn().mockResolvedValue({
        enrollmentId: 'enr-1',
        courseId: 'course-1',
        completedLessons: 0,
        totalLessons: 0,
        percentComplete: 0,
      }),
      getModuleProgress: vi.fn(),
      ...overrides.progressQuery,
    },
  };
}

function makeUseCase(repos: ReturnType<typeof makeRepos>): GetEnrolledCourseUseCase {
  return new GetEnrolledCourseUseCase(
    repos.courseRepo,
    repos.moduleRepo,
    repos.lessonRepo,
    repos.enrollmentRepo,
    repos.lessonProgressRepo,
    repos.progressQuery,
  );
}

describe('GetEnrolledCourseUseCase', () => {
  it('returns null for a nonexistent or cross-tenant course (no data leak)', async () => {
    const repos = makeRepos({ courseRepo: { findById: vi.fn().mockResolvedValue(null) } });
    const useCase = makeUseCase(repos);

    const view = await useCase.execute(studentCtx, 'course-does-not-exist');

    expect(view).toBeNull();
    expect(repos.moduleRepo.findByCourse).not.toHaveBeenCalled();
  });

  it('overlays completed=false everywhere and progressPercent=0 when the caller is NOT enrolled', async () => {
    const course = makeCourse();
    const mod1 = makeModule();
    const lessons = [
      makeTextLesson({ id: 'l1', title: 'L1', position: 1 }),
      makeTextLesson({ id: 'l2', title: 'L2', position: 2 }),
    ];
    const repos = makeRepos({
      courseRepo: { findById: vi.fn().mockResolvedValue(course) },
      enrollmentRepo: { findByCourseAndUser: vi.fn().mockResolvedValue(null) },
      moduleRepo: { findByCourse: vi.fn().mockResolvedValue([mod1]) },
      lessonRepo: { findByModule: vi.fn().mockResolvedValue(lessons) },
    });
    const useCase = makeUseCase(repos);

    const view = await useCase.execute(studentCtx, 'course-1');

    expect(view).not.toBeNull();
    expect(view?.isEnrolled).toBe(false);
    expect(view?.enrollmentId).toBeNull();
    expect(view?.progressPercent).toBe(0);
    expect(view?.modules[0]?.lessons.map((l) => l.completed)).toEqual([false, false]);
    expect(repos.lessonProgressRepo.findByEnrollment).not.toHaveBeenCalled();
    expect(repos.progressQuery.getCourseProgress).not.toHaveBeenCalled();
  });

  it('overlays per-lesson completed from lessonProgressRepo and percent from progressQuery when enrolled', async () => {
    const course = makeCourse();
    const mod1 = makeModule();
    const lessons = [
      makeTextLesson({ id: 'l1', title: 'L1', position: 1 }),
      makeTextLesson({ id: 'l2', title: 'L2', position: 2 }),
    ];
    const enrollment = makeEnrollment({ id: 'enr-1' });
    const progressRecords = [makeLessonProgress({ id: 'p1', enrollmentId: 'enr-1', lessonId: 'l1' })];

    const repos = makeRepos({
      courseRepo: { findById: vi.fn().mockResolvedValue(course) },
      enrollmentRepo: { findByCourseAndUser: vi.fn().mockResolvedValue(enrollment) },
      moduleRepo: { findByCourse: vi.fn().mockResolvedValue([mod1]) },
      lessonRepo: { findByModule: vi.fn().mockResolvedValue(lessons) },
      lessonProgressRepo: { findByEnrollment: vi.fn().mockResolvedValue(progressRecords) },
      progressQuery: {
        getCourseProgress: vi.fn().mockResolvedValue({
          enrollmentId: 'enr-1',
          courseId: 'course-1',
          completedLessons: 1,
          totalLessons: 2,
          percentComplete: 50,
        }),
      },
    });
    const useCase = makeUseCase(repos);

    const view = await useCase.execute(studentCtx, 'course-1');

    expect(view?.isEnrolled).toBe(true);
    expect(view?.enrollmentId).toBe('enr-1');
    expect(view?.progressPercent).toBe(50);
    expect(view?.modules[0]?.lessons.map((l) => ({ id: l.id, completed: l.completed }))).toEqual([
      { id: 'l1', completed: true },
      { id: 'l2', completed: false },
    ]);
    expect(repos.lessonProgressRepo.findByEnrollment).toHaveBeenCalledWith(studentCtx, 'enr-1');
    expect(repos.progressQuery.getCourseProgress).toHaveBeenCalledWith(studentCtx, 'enr-1', 'course-1');
  });
});
