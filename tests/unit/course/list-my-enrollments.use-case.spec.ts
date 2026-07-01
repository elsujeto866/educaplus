/**
 * ListMyEnrollmentsUseCase unit tests.
 *
 * Mocked EnrollmentRepository, no DB. Asserts the use-case scopes the read
 * to the CALLER (ctx.userId) — never another member's enrollments.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { ListMyEnrollmentsUseCase } from '../../../src/modules/course/application/list-my-enrollments.use-case';
import { Enrollment } from '../../../src/modules/course/domain/enrollment.entity';
import type { EnrollmentRepository } from '../../../src/modules/course/domain/ports/enrollment.repository';

const now = new Date('2025-01-01T00:00:00Z');

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

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

function makeEnrollmentRepo(overrides: Partial<EnrollmentRepository> = {}): EnrollmentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByCourseAndUser: vi.fn(),
    findByCourse: vi.fn(),
    findByLearner: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    existsByCourseAndUser: vi.fn(),
    ...overrides,
  };
}

describe('ListMyEnrollmentsUseCase', () => {
  it('returns the caller enrollments from findByLearner scoped to ctx.userId', async () => {
    const enrollments = [
      makeEnrollment({ id: 'enr-1', courseId: 'course-1' }),
      makeEnrollment({ id: 'enr-2', courseId: 'course-2' }),
    ];
    const enrollmentRepo = makeEnrollmentRepo({
      findByLearner: vi.fn().mockResolvedValue(enrollments),
    });
    const useCase = new ListMyEnrollmentsUseCase(enrollmentRepo);

    const result = await useCase.execute(studentCtx);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['enr-1', 'enr-2']);
    expect(enrollmentRepo.findByLearner).toHaveBeenCalledWith(studentCtx, 'user_3');
  });

  it('returns an empty array when the caller has no enrollments', async () => {
    const enrollmentRepo = makeEnrollmentRepo({
      findByLearner: vi.fn().mockResolvedValue([]),
    });
    const useCase = new ListMyEnrollmentsUseCase(enrollmentRepo);

    const result = await useCase.execute(studentCtx);

    expect(result).toEqual([]);
  });
});
