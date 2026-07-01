/**
 * Application use-case unit tests — course module.
 *
 * All repositories are mocked with vi.fn() — no DB, no infrastructure.
 * These tests verify use-case orchestration, guard enforcement, and domain
 * invariant propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import { CreateCourseUseCase } from '../../../src/modules/course/application/create-course.use-case';
import { UpdateCourseUseCase } from '../../../src/modules/course/application/update-course.use-case';
import { PublishCourseUseCase } from '../../../src/modules/course/application/publish-course.use-case';
import { UnpublishCourseUseCase } from '../../../src/modules/course/application/unpublish-course.use-case';
import { AddModuleUseCase } from '../../../src/modules/course/application/add-module.use-case';
import { ReorderModulesUseCase } from '../../../src/modules/course/application/reorder-modules.use-case';
import { InvalidReorderError } from '../../../src/modules/course/domain/errors';
import { AddLessonUseCase } from '../../../src/modules/course/application/add-lesson.use-case';
import { ReorderLessonsUseCase } from '../../../src/modules/course/application/reorder-lessons.use-case';
import { EnrollLearnerUseCase } from '../../../src/modules/course/application/enroll-learner.use-case';
import { MarkLessonCompleteUseCase } from '../../../src/modules/course/application/mark-lesson-complete.use-case';
import { Course } from '../../../src/modules/course/domain/course.entity';
import { CourseModule } from '../../../src/modules/course/domain/course-module.entity';
import { Lesson } from '../../../src/modules/course/domain/lesson.entity';
import { Enrollment } from '../../../src/modules/course/domain/enrollment.entity';
import {
  SlugConflictError,
  CourseNotPublishedError,
  DuplicateEnrollmentError,
} from '../../../src/modules/course/domain/errors';
import type { CourseRepository } from '../../../src/modules/course/domain/ports/course.repository';
import type { CourseModuleRepository } from '../../../src/modules/course/domain/ports/course-module.repository';
import type { LessonRepository } from '../../../src/modules/course/domain/ports/lesson.repository';
import type { EnrollmentRepository } from '../../../src/modules/course/domain/ports/enrollment.repository';
import type { LessonProgressRepository } from '../../../src/modules/course/domain/ports/lesson-progress.repository';
import type { ProgressQuery, CourseProgress } from '../../../src/modules/course/domain/ports/progress-query';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const now = new Date('2025-01-01T00:00:00Z');

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'admin' };
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };
const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

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

function makeLesson(id = 'lesson-1'): Lesson {
  return new Lesson({
    id,
    moduleId: 'mod-1',
    academyId: 'org_A',
    type: 'text',
    title: 'Lesson 1',
    position: 1,
    content: { type: 'text', body: {} },
    createdAt: now,
    updatedAt: now,
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

// ---------------------------------------------------------------------------
// 1. CreateCourseUseCase
// ---------------------------------------------------------------------------

describe('CreateCourseUseCase', () => {
  let courseRepo: CourseRepository;
  let useCase: CreateCourseUseCase;

  beforeEach(() => {
    courseRepo = {
      create: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByAcademy: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsBySlug: vi.fn().mockResolvedValue(false),
      maxPositionByAcademy: vi.fn().mockResolvedValue(0),
    };
    useCase = new CreateCourseUseCase(courseRepo);
  });

  it('creates a course in DRAFT at position max+1', async () => {
    vi.mocked(courseRepo.maxPositionByAcademy).mockResolvedValue(2);

    const course = await useCase.execute(adminCtx, {
      id: 'course-new',
      academyId: 'org_A',
      title: 'My Course',
    });

    expect(course.status).toBe('draft');
    expect(course.position).toBe(3);
    expect(course.slug).toBe('my-course');
    expect(courseRepo.create).toHaveBeenCalledOnce();
  });

  it('throws SlugConflictError when slug already exists', async () => {
    vi.mocked(courseRepo.existsBySlug).mockResolvedValue(true);

    await expect(
      useCase.execute(adminCtx, { id: 'c2', academyId: 'org_A', title: 'Intro to TS' }),
    ).rejects.toThrow(SlugConflictError);
  });

  it('throws UnauthorizedError when role is student', async () => {
    await expect(
      useCase.execute(learnerCtx, { id: 'c3', academyId: 'org_A', title: 'Course' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('allows instructor to create a course', async () => {
    const course = await useCase.execute(instructorCtx, {
      id: 'c4',
      academyId: 'org_A',
      title: 'Another Course',
    });
    expect(course.status).toBe('draft');
  });
});

// ---------------------------------------------------------------------------
// 2. PublishCourseUseCase / UnpublishCourseUseCase — publish/unpublish cycle
// ---------------------------------------------------------------------------

describe('publish/unpublish cycle', () => {
  let courseRepo: CourseRepository;

  beforeEach(() => {
    courseRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByAcademy: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      existsBySlug: vi.fn(),
      maxPositionByAcademy: vi.fn(),
    };
  });

  it('publish sets status=published and records publishedAt', async () => {
    const draft = makeCourse({ status: 'draft', publishedAt: null });
    vi.mocked(courseRepo.findById).mockResolvedValue(draft);

    const publishUC = new PublishCourseUseCase(courseRepo);
    const published = await publishUC.execute(adminCtx, { id: 'course-1' });

    expect(published.status).toBe('published');
    expect(published.publishedAt).toBeInstanceOf(Date);
  });

  it('unpublish clears status to draft and nulls publishedAt', async () => {
    const pub = makeCourse({ status: 'published', publishedAt: now });
    vi.mocked(courseRepo.findById).mockResolvedValue(pub);

    const unpublishUC = new UnpublishCourseUseCase(courseRepo);
    const unpublished = await unpublishUC.execute(adminCtx, { id: 'course-1' });

    expect(unpublished.status).toBe('draft');
    expect(unpublished.publishedAt).toBeNull();
  });

  it('publish throws UnauthorizedError for student', async () => {
    vi.mocked(courseRepo.findById).mockResolvedValue(makeCourse());
    const publishUC = new PublishCourseUseCase(courseRepo);

    await expect(publishUC.execute(learnerCtx, { id: 'course-1' })).rejects.toThrow(
      UnauthorizedError,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. UpdateCourseUseCase — slug conflict on title change
// ---------------------------------------------------------------------------

describe('UpdateCourseUseCase', () => {
  it('throws SlugConflictError when new title produces a taken slug', async () => {
    const courseRepo: CourseRepository = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeCourse()),
      findBySlug: vi.fn(),
      findByAcademy: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsBySlug: vi.fn().mockResolvedValue(true),
      maxPositionByAcademy: vi.fn(),
    };

    const useCase = new UpdateCourseUseCase(courseRepo);
    await expect(
      useCase.execute(adminCtx, { id: 'course-1', title: 'Taken Title' }),
    ).rejects.toThrow(SlugConflictError);
  });
});

// ---------------------------------------------------------------------------
// 4. AddModuleUseCase — position = count + 1
// ---------------------------------------------------------------------------

describe('AddModuleUseCase', () => {
  it('assigns position = count + 1', async () => {
    const moduleRepo: CourseModuleRepository = {
      create: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByCourse: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByCourse: vi.fn().mockResolvedValue(3),
      reorder: vi.fn(),
    };

    const useCase = new AddModuleUseCase(moduleRepo);
    const mod = await useCase.execute(adminCtx, {
      id: 'mod-new',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Module 4',
    });

    expect(mod.position).toBe(4);
    expect(moduleRepo.create).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 4b. AddLessonUseCase — video lesson external URL round-trip
// ---------------------------------------------------------------------------

describe('AddLessonUseCase', () => {
  function makeLessonRepo(overrides: Partial<LessonRepository> = {}): LessonRepository {
    return {
      create: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByModule: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByModule: vi.fn().mockResolvedValue(0),
      reorder: vi.fn(),
      ...overrides,
    };
  }

  it('creates a video lesson carrying the given external URL', async () => {
    const lessonRepo = makeLessonRepo();
    const useCase = new AddLessonUseCase(lessonRepo);

    const lesson = await useCase.execute(adminCtx, {
      id: 'lesson-ext-1',
      moduleId: 'mod-1',
      academyId: 'org_A',
      type: 'video',
      title: 'External Video Lesson',
      content: {
        type: 'video',
        cloudflareUid: null,
        durationSeconds: null,
        thumbnailUrl: null,
        externalUrl: 'https://youtube.com/watch?v=abc123',
      },
    });

    expect(lesson.content).toMatchObject({
      type: 'video',
      externalUrl: 'https://youtube.com/watch?v=abc123',
    });
    expect(lessonRepo.create).toHaveBeenCalledWith(
      adminCtx,
      expect.objectContaining({
        content: expect.objectContaining({ externalUrl: 'https://youtube.com/watch?v=abc123' }),
      }),
    );
  });

  it('regression: creates a video lesson with no external URL (Cloudflare pipeline only)', async () => {
    const lessonRepo = makeLessonRepo();
    const useCase = new AddLessonUseCase(lessonRepo);

    const lesson = await useCase.execute(adminCtx, {
      id: 'lesson-cf-1',
      moduleId: 'mod-1',
      academyId: 'org_A',
      type: 'video',
      title: 'Cloudflare Video Lesson',
      content: {
        type: 'video',
        cloudflareUid: null,
        durationSeconds: null,
        thumbnailUrl: null,
        externalUrl: null,
      },
    });

    expect(lesson.content).toMatchObject({ type: 'video', externalUrl: null });
  });
});

// ---------------------------------------------------------------------------
// 5. ReorderModulesUseCase — rejects foreign IDs
// ---------------------------------------------------------------------------

describe('ReorderModulesUseCase', () => {
  it('rejects an ID that does not belong to the course', async () => {
    const m1 = makeModule({ id: 'mod-1' });
    const m2 = makeModule({ id: 'mod-2' });

    const moduleRepo: CourseModuleRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByCourse: vi.fn().mockResolvedValue([m1, m2]),
      update: vi.fn(),
      delete: vi.fn(),
      countByCourse: vi.fn(),
      reorder: vi.fn(),
    };

    const useCase = new ReorderModulesUseCase(moduleRepo);
    await expect(
      useCase.execute(adminCtx, { courseId: 'course-1', orderedIds: ['mod-1', 'mod-FOREIGN'] }),
    ).rejects.toThrow(InvalidReorderError);
    expect(moduleRepo.reorder).not.toHaveBeenCalled();
  });

  it('calls reorder with valid ids', async () => {
    const m1 = makeModule({ id: 'mod-1' });
    const m2 = makeModule({ id: 'mod-2' });

    const moduleRepo: CourseModuleRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByCourse: vi.fn().mockResolvedValue([m1, m2]),
      update: vi.fn(),
      delete: vi.fn(),
      countByCourse: vi.fn(),
      reorder: vi.fn().mockResolvedValue(undefined),
    };

    const useCase = new ReorderModulesUseCase(moduleRepo);
    await useCase.execute(adminCtx, { courseId: 'course-1', orderedIds: ['mod-2', 'mod-1'] });

    expect(moduleRepo.reorder).toHaveBeenCalledWith(adminCtx, 'course-1', ['mod-2', 'mod-1']);
  });
});

// ---------------------------------------------------------------------------
// 6. ReorderLessonsUseCase — rejects foreign IDs
// ---------------------------------------------------------------------------

describe('ReorderLessonsUseCase', () => {
  it('rejects a lesson ID that does not belong to the module', async () => {
    const lessonRepo: LessonRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByModule: vi.fn().mockResolvedValue([makeLesson('lesson-1'), makeLesson('lesson-2')]),
      update: vi.fn(),
      delete: vi.fn(),
      countByModule: vi.fn(),
      reorder: vi.fn(),
    };

    const useCase = new ReorderLessonsUseCase(lessonRepo);
    await expect(
      useCase.execute(adminCtx, { moduleId: 'mod-1', orderedIds: ['lesson-1', 'lesson-FOREIGN'] }),
    ).rejects.toThrow(InvalidReorderError);
  });
});

// ---------------------------------------------------------------------------
// 7. EnrollLearnerUseCase — draft guard + duplicate guard
// ---------------------------------------------------------------------------

describe('EnrollLearnerUseCase', () => {
  function makeEnrollmentRepos(course: Course, alreadyEnrolled = false): {
    courseRepo: CourseRepository;
    enrollmentRepo: EnrollmentRepository;
  } {
    return {
      courseRepo: {
        create: vi.fn(),
        findById: vi.fn().mockResolvedValue(course),
        findBySlug: vi.fn(),
        findByAcademy: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        existsBySlug: vi.fn(),
        maxPositionByAcademy: vi.fn(),
      },
      enrollmentRepo: {
        create: vi.fn().mockResolvedValue(undefined),
        findById: vi.fn(),
        findByCourseAndUser: vi.fn(),
        findByCourse: vi.fn(),
        update: vi.fn(),
        existsByCourseAndUser: vi.fn().mockResolvedValue(alreadyEnrolled),
      },
    };
  }

  it('throws CourseNotPublishedError when enrolling in a DRAFT course', async () => {
    const draft = makeCourse({ status: 'draft' });
    const { courseRepo, enrollmentRepo } = makeEnrollmentRepos(draft);
    const useCase = new EnrollLearnerUseCase(courseRepo, enrollmentRepo);

    await expect(
      useCase.execute(learnerCtx, {
        id: 'enr-1',
        courseId: 'course-1',
        academyId: 'org_A',
        clerkUserId: 'user_3',
      }),
    ).rejects.toThrow(CourseNotPublishedError);
  });

  it('throws DuplicateEnrollmentError when already enrolled', async () => {
    const published = makeCourse({ status: 'published', publishedAt: now });
    const { courseRepo, enrollmentRepo } = makeEnrollmentRepos(published, true);
    const useCase = new EnrollLearnerUseCase(courseRepo, enrollmentRepo);

    await expect(
      useCase.execute(learnerCtx, {
        id: 'enr-2',
        courseId: 'course-1',
        academyId: 'org_A',
        clerkUserId: 'user_3',
      }),
    ).rejects.toThrow(DuplicateEnrollmentError);
  });

  it('successfully enrolls in a published course', async () => {
    const published = makeCourse({ status: 'published', publishedAt: now });
    const { courseRepo, enrollmentRepo } = makeEnrollmentRepos(published, false);
    const useCase = new EnrollLearnerUseCase(courseRepo, enrollmentRepo);

    const enrollment = await useCase.execute(learnerCtx, {
      id: 'enr-3',
      courseId: 'course-1',
      academyId: 'org_A',
      clerkUserId: 'user_3',
    });

    expect(enrollment.courseId).toBe('course-1');
    expect(enrollment.completedAt).toBeNull();
    expect(enrollmentRepo.create).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 8. MarkLessonCompleteUseCase — idempotency + auto-complete
// ---------------------------------------------------------------------------

describe('MarkLessonCompleteUseCase', () => {
  it('calls lessonProgressRepo.upsert even when lesson was already completed', async () => {
    const enrollment = makeEnrollment({ completedAt: null });

    const lessonProgressRepo: LessonProgressRepository = {
      upsert: vi.fn().mockResolvedValue(undefined),
      findByEnrollment: vi.fn(),
      findByEnrollmentAndLesson: vi.fn(),
    };
    const enrollmentRepo: EnrollmentRepository = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(enrollment),
      findByCourseAndUser: vi.fn(),
      findByCourse: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      existsByCourseAndUser: vi.fn(),
    };
    const progressQuery: ProgressQuery = {
      getCourseProgress: vi.fn().mockResolvedValue({
        enrollmentId: 'enr-1',
        courseId: 'course-1',
        completedLessons: 5,
        totalLessons: 5,
        percentComplete: 100,
      } satisfies CourseProgress),
      getModuleProgress: vi.fn(),
    };

    const useCase = new MarkLessonCompleteUseCase(
      lessonProgressRepo,
      enrollmentRepo,
      progressQuery,
    );

    await useCase.execute(learnerCtx, {
      id: 'lp-1',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-1',
      academyId: 'org_A',
    });

    // Upsert is always called — idempotent at the repo level
    expect(lessonProgressRepo.upsert).toHaveBeenCalledOnce();
    // Enrollment updated because pct = 100 and not yet completed
    expect(enrollmentRepo.update).toHaveBeenCalledOnce();
  });

  it('does NOT update enrollment when course is already marked complete', async () => {
    const enrollment = makeEnrollment({ completedAt: new Date() });

    const lessonProgressRepo: LessonProgressRepository = {
      upsert: vi.fn().mockResolvedValue(undefined),
      findByEnrollment: vi.fn(),
      findByEnrollmentAndLesson: vi.fn(),
    };
    const enrollmentRepo: EnrollmentRepository = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(enrollment),
      findByCourseAndUser: vi.fn(),
      findByCourse: vi.fn(),
      update: vi.fn(),
      existsByCourseAndUser: vi.fn(),
    };
    const progressQuery: ProgressQuery = {
      getCourseProgress: vi.fn().mockResolvedValue({
        enrollmentId: 'enr-1',
        courseId: 'course-1',
        completedLessons: 5,
        totalLessons: 5,
        percentComplete: 100,
      } satisfies CourseProgress),
      getModuleProgress: vi.fn(),
    };

    const useCase = new MarkLessonCompleteUseCase(
      lessonProgressRepo,
      enrollmentRepo,
      progressQuery,
    );

    await useCase.execute(learnerCtx, {
      id: 'lp-2',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-2',
      academyId: 'org_A',
    });

    // Upsert still called (idempotent)
    expect(lessonProgressRepo.upsert).toHaveBeenCalledOnce();
    // Enrollment.update NOT called — already completed
    expect(enrollmentRepo.update).not.toHaveBeenCalled();
  });

  it('does NOT update enrollment when course is not yet 100 % complete', async () => {
    const enrollment = makeEnrollment({ completedAt: null });

    const lessonProgressRepo: LessonProgressRepository = {
      upsert: vi.fn().mockResolvedValue(undefined),
      findByEnrollment: vi.fn(),
      findByEnrollmentAndLesson: vi.fn(),
    };
    const enrollmentRepo: EnrollmentRepository = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(enrollment),
      findByCourseAndUser: vi.fn(),
      findByCourse: vi.fn(),
      update: vi.fn(),
      existsByCourseAndUser: vi.fn(),
    };
    const progressQuery: ProgressQuery = {
      getCourseProgress: vi.fn().mockResolvedValue({
        enrollmentId: 'enr-1',
        courseId: 'course-1',
        completedLessons: 3,
        totalLessons: 5,
        percentComplete: 60,
      } satisfies CourseProgress),
      getModuleProgress: vi.fn(),
    };

    const useCase = new MarkLessonCompleteUseCase(
      lessonProgressRepo,
      enrollmentRepo,
      progressQuery,
    );

    await useCase.execute(learnerCtx, {
      id: 'lp-3',
      enrollmentId: 'enr-1',
      lessonId: 'lesson-3',
      academyId: 'org_A',
    });

    expect(lessonProgressRepo.upsert).toHaveBeenCalledOnce();
    expect(enrollmentRepo.update).not.toHaveBeenCalled();
  });
});
