/**
 * ListCoursesUseCase unit tests.
 *
 * Mirrors get-academy.use-case.spec.ts style — read-only, no assertRole,
 * mocked CourseRepository, no DB.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { ListCoursesUseCase } from '../../../src/modules/course/application/list-courses.use-case';
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
    status: 'draft',
    position: 1,
    publishedAt: null,
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
    findByAcademy: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
    existsBySlug: vi.fn(),
    maxPositionByAcademy: vi.fn(),
    ...overrides,
  };
}

describe('ListCoursesUseCase', () => {
  it('returns the academy courses from findByAcademy scoped to ctx.orgId', async () => {
    const courses = [
      makeCourse({ id: 'c1', title: 'Course A' }),
      makeCourse({ id: 'c2', title: 'Course B' }),
      makeCourse({ id: 'c3', title: 'Course C' }),
    ];
    const courseRepo = makeCourseRepo({ findByAcademy: vi.fn().mockResolvedValue(courses) });
    const useCase = new ListCoursesUseCase(courseRepo);

    const result = await useCase.execute(studentCtx);

    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(courseRepo.findByAcademy).toHaveBeenCalledWith(studentCtx, 'org_A');
  });

  it('does not enforce a role guard — read use-case, any authenticated tenant member', async () => {
    const courseRepo = makeCourseRepo({ findByAcademy: vi.fn().mockResolvedValue([makeCourse()]) });
    const useCase = new ListCoursesUseCase(courseRepo);

    // studentCtx has role 'student' — should NOT throw UnauthorizedError.
    await expect(useCase.execute(studentCtx)).resolves.toHaveLength(1);
  });
});
