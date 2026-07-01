/**
 * ListPublishedCoursesUseCase unit tests.
 *
 * Mirrors list-courses.use-case.spec.ts style — read-only, no assertRole,
 * mocked CourseRepository, no DB. Asserts the use-case delegates to the
 * published-only finder (not the generic findByAcademy) scoped to ctx.orgId.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { ListPublishedCoursesUseCase } from '../../../src/modules/course/application/list-published-courses.use-case';
import { Course } from '../../../src/modules/course/domain/course.entity';
import type { CourseRepository } from '../../../src/modules/course/domain/ports/course.repository';

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

function makeCourseRepo(overrides: Partial<CourseRepository> = {}): CourseRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findByAcademy: vi.fn(),
    findPublishedByAcademy: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    existsBySlug: vi.fn(),
    maxPositionByAcademy: vi.fn(),
    ...overrides,
  };
}

describe('ListPublishedCoursesUseCase', () => {
  it('returns published courses from findPublishedByAcademy scoped to ctx.orgId', async () => {
    const courses = [
      makeCourse({ id: 'c1', title: 'Course A' }),
      makeCourse({ id: 'c2', title: 'Course B' }),
    ];
    const courseRepo = makeCourseRepo({
      findPublishedByAcademy: vi.fn().mockResolvedValue(courses),
    });
    const useCase = new ListPublishedCoursesUseCase(courseRepo);

    const result = await useCase.execute(studentCtx);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(courseRepo.findPublishedByAcademy).toHaveBeenCalledWith(studentCtx, 'org_A');
    expect(courseRepo.findByAcademy).not.toHaveBeenCalled();
  });

  it('returns an empty array when the academy has no published courses', async () => {
    const courseRepo = makeCourseRepo({
      findPublishedByAcademy: vi.fn().mockResolvedValue([]),
    });
    const useCase = new ListPublishedCoursesUseCase(courseRepo);

    const result = await useCase.execute(studentCtx);

    expect(result).toEqual([]);
  });
});
