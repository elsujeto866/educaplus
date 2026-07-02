/**
 * GetAttemptsUseCase / GetLatestPassedUseCase unit tests — fake repos, no DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import {
  GetAttemptsUseCase,
  GetLatestPassedUseCase,
} from '../../../src/modules/course/application/get-attempts.use-case';
import type { AssessmentRepository } from '../../../src/modules/course/domain/ports/assessment.repository';
import type { AssessmentAttemptRepository } from '../../../src/modules/course/domain/ports/assessment-attempt.repository';
import { Assessment } from '../../../src/modules/course/domain/assessment.entity';
import { AssessmentAttempt } from '../../../src/modules/course/domain/assessment-attempt.entity';

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

function makeAssessment(): Assessment {
  return new Assessment({
    id: 'assess-1',
    courseId: 'course-1',
    academyId: 'org_A',
    title: 'Quiz 1',
    passingScore: 70,
    questions: [],
    createdAt: now,
    updatedAt: now,
  });
}

function makeAttempt(overrides: Partial<ConstructorParameters<typeof AssessmentAttempt>[0]> = {}) {
  return new AssessmentAttempt({
    id: 'attempt-1',
    assessmentId: 'assess-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    answers: [],
    score: 0,
    passed: false,
    createdAt: now,
    ...overrides,
  });
}

describe('GetAttemptsUseCase', () => {
  let assessmentRepo: AssessmentRepository;
  let attemptRepo: AssessmentAttemptRepository;

  beforeEach(() => {
    assessmentRepo = {
      upsert: vi.fn(),
      findById: vi.fn(),
      findByCourse: vi.fn().mockResolvedValue(makeAssessment()),
      delete: vi.fn(),
    };
    attemptRepo = {
      create: vi.fn(),
      findByUserAndAssessment: vi.fn().mockResolvedValue([]),
      findLatestPassed: vi.fn(),
    };
  });

  it('returns [] when the course has no assessment', async () => {
    assessmentRepo.findByCourse = vi.fn().mockResolvedValue(null);
    const useCase = new GetAttemptsUseCase(assessmentRepo, attemptRepo);

    const result = await useCase.execute(studentCtx, 'course-1');
    expect(result).toEqual([]);
    expect(attemptRepo.findByUserAndAssessment).not.toHaveBeenCalled();
  });

  it('resolves the assessment then queries attempts for the caller', async () => {
    const attempts = [makeAttempt({ id: 'attempt-2' }), makeAttempt({ id: 'attempt-1' })];
    attemptRepo.findByUserAndAssessment = vi.fn().mockResolvedValue(attempts);
    const useCase = new GetAttemptsUseCase(assessmentRepo, attemptRepo);

    const result = await useCase.execute(studentCtx, 'course-1');
    expect(result).toBe(attempts);
    expect(attemptRepo.findByUserAndAssessment).toHaveBeenCalledWith(
      studentCtx,
      'assess-1',
      'user_1',
    );
  });
});

describe('GetLatestPassedUseCase', () => {
  let assessmentRepo: AssessmentRepository;
  let attemptRepo: AssessmentAttemptRepository;

  beforeEach(() => {
    assessmentRepo = {
      upsert: vi.fn(),
      findById: vi.fn(),
      findByCourse: vi.fn().mockResolvedValue(makeAssessment()),
      delete: vi.fn(),
    };
    attemptRepo = {
      create: vi.fn(),
      findByUserAndAssessment: vi.fn(),
      findLatestPassed: vi.fn().mockResolvedValue(null),
    };
  });

  it('returns null when the course has no assessment', async () => {
    assessmentRepo.findByCourse = vi.fn().mockResolvedValue(null);
    const useCase = new GetLatestPassedUseCase(assessmentRepo, attemptRepo);

    const result = await useCase.execute(studentCtx, 'course-1');
    expect(result).toBeNull();
    expect(attemptRepo.findLatestPassed).not.toHaveBeenCalled();
  });

  it('returns the passing attempt regardless of subsequent failed attempts', async () => {
    const passed = makeAttempt({ id: 'attempt-pass', passed: true, score: 80 });
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(passed);
    const useCase = new GetLatestPassedUseCase(assessmentRepo, attemptRepo);

    const result = await useCase.execute(studentCtx, 'course-1');
    expect(result).toBe(passed);
    expect(attemptRepo.findLatestPassed).toHaveBeenCalledWith(studentCtx, 'assess-1', 'user_1');
  });
});
