/**
 * SubmitAttemptUseCase unit tests — fake repos (vi.fn()), no DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { SubmitAttemptUseCase } from '../../../src/modules/course/application/submit-attempt.use-case';
import {
  CourseNotFoundError,
  LearnerNotEnrolledError,
  EmptyQuizError,
  InvalidAttemptError,
} from '../../../src/modules/course/domain/errors';
import type { AssessmentRepository } from '../../../src/modules/course/domain/ports/assessment.repository';
import type { EnrollmentRepository } from '../../../src/modules/course/domain/ports/enrollment.repository';
import type { AssessmentAttemptRepository } from '../../../src/modules/course/domain/ports/assessment-attempt.repository';
import { Assessment } from '../../../src/modules/course/domain/assessment.entity';
import { QuizQuestionFactory } from '../../../src/modules/course/domain/value-objects/quiz-question.vo';

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

const now = new Date('2025-01-01T00:00:00Z');

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return QuizQuestionFactory.create({
    type: 'single',
    id: (overrides['id'] as string) ?? 'q-1',
    prompt: (overrides['prompt'] as string) ?? 'What is 2 + 2?',
    options: (overrides['options'] as { id: string; label: string }[]) ?? [
      { id: 'opt-1', label: '3' },
      { id: 'opt-2', label: '4' },
    ],
    correctOptionId: (overrides['correctOptionId'] as string) ?? 'opt-2',
  });
}

function makeAssessment(overrides: Partial<ConstructorParameters<typeof Assessment>[0]> = {}) {
  return new Assessment({
    id: 'assess-1',
    courseId: 'course-1',
    academyId: 'org_A',
    title: 'Quiz 1',
    passingScore: 70,
    questions: [makeQuestion()],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('SubmitAttemptUseCase', () => {
  let assessmentRepo: AssessmentRepository;
  let enrollmentRepo: EnrollmentRepository;
  let attemptRepo: AssessmentAttemptRepository;
  let useCase: SubmitAttemptUseCase;

  beforeEach(() => {
    assessmentRepo = {
      upsert: vi.fn(),
      findById: vi.fn(),
      findByCourse: vi.fn().mockResolvedValue(makeAssessment()),
      delete: vi.fn(),
    };
    enrollmentRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByCourseAndUser: vi.fn(),
      findByCourse: vi.fn(),
      findByLearner: vi.fn(),
      update: vi.fn(),
      existsByCourseAndUser: vi.fn().mockResolvedValue(true),
    };
    attemptRepo = {
      create: vi.fn().mockResolvedValue(undefined),
      findByUserAndAssessment: vi.fn(),
      findLatestPassed: vi.fn(),
    };
    useCase = new SubmitAttemptUseCase(assessmentRepo, enrollmentRepo, attemptRepo);
  });

  it('rejects a non-enrolled student before persisting anything', async () => {
    enrollmentRepo.existsByCourseAndUser = vi.fn().mockResolvedValue(false);

    await expect(
      useCase.execute(studentCtx, {
        id: 'attempt-1',
        courseId: 'course-1',
        answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
      }),
    ).rejects.toThrow(LearnerNotEnrolledError);
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });

  it('rejects when the course has no assessment', async () => {
    assessmentRepo.findByCourse = vi.fn().mockResolvedValue(null);

    await expect(
      useCase.execute(studentCtx, {
        id: 'attempt-1',
        courseId: 'course-1',
        answers: [],
      }),
    ).rejects.toThrow(CourseNotFoundError);
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });

  it('happy path: persists the attempt and returns {score, passed}', async () => {
    const result = await useCase.execute(studentCtx, {
      id: 'attempt-1',
      courseId: 'course-1',
      answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
    });

    expect(result).toEqual({ score: 100, passed: true });
    expect(attemptRepo.create).toHaveBeenCalledOnce();
    expect(attemptRepo.create).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({
        id: 'attempt-1',
        assessmentId: 'assess-1',
        academyId: 'org_A',
        clerkUserId: 'user_1',
        score: 100,
        passed: true,
      }),
    );
  });

  it('retake: a second submission persists a second, independent row', async () => {
    await useCase.execute(studentCtx, {
      id: 'attempt-1',
      courseId: 'course-1',
      answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
    });
    await useCase.execute(studentCtx, {
      id: 'attempt-2',
      courseId: 'course-1',
      answers: [{ questionId: 'q-1', selectedOptionId: 'opt-1' }],
    });

    expect(attemptRepo.create).toHaveBeenCalledTimes(2);
    expect(attemptRepo.create).toHaveBeenNthCalledWith(
      2,
      studentCtx,
      expect.objectContaining({ id: 'attempt-2', score: 0, passed: false }),
    );
  });

  it('propagates EmptyQuizError for a zero-question assessment before persisting', async () => {
    assessmentRepo.findByCourse = vi.fn().mockResolvedValue(makeAssessment({ questions: [] }));

    await expect(
      useCase.execute(studentCtx, {
        id: 'attempt-1',
        courseId: 'course-1',
        answers: [],
      }),
    ).rejects.toThrow(EmptyQuizError);
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });

  it('propagates InvalidAttemptError for an unknown questionId before persisting', async () => {
    await expect(
      useCase.execute(studentCtx, {
        id: 'attempt-1',
        courseId: 'course-1',
        answers: [{ questionId: 'q-unknown', selectedOptionId: 'opt-2' }],
      }),
    ).rejects.toThrow(InvalidAttemptError);
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });

  it('rejects the duplicate-answer certificate-forgery exploit: repeating one known-correct answer never scores/persists a pass', async () => {
    assessmentRepo.findByCourse = vi.fn().mockResolvedValue(
      makeAssessment({
        questions: [
          makeQuestion({ id: 'q-1', correctOptionId: 'opt-2' }),
          makeQuestion({
            id: 'q-2',
            options: [
              { id: 'opt-3', label: '3' },
              { id: 'opt-4', label: '4' },
            ],
            correctOptionId: 'opt-4',
          }),
          makeQuestion({
            id: 'q-3',
            options: [
              { id: 'opt-5', label: 'Yes' },
              { id: 'opt-6', label: 'No' },
            ],
            correctOptionId: 'opt-5',
          }),
        ],
      }),
    );

    await expect(
      useCase.execute(studentCtx, {
        id: 'attempt-1',
        courseId: 'course-1',
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-2' },
          { questionId: 'q-1', selectedOptionId: 'opt-2' },
          { questionId: 'q-1', selectedOptionId: 'opt-2' },
        ],
      }),
    ).rejects.toThrow(InvalidAttemptError);
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });
});
