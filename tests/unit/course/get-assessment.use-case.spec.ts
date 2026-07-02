/**
 * GetAssessmentUseCase unit tests.
 *
 * Fake AssessmentRepository — no DB. Read-only prefill use-case (mirrors
 * GetLessonUseCase): no `assertRole` guard, page-level gating decides who
 * may reach it. Serves both the quiz builder's prefill and the wizard's
 * `hasQuiz` derivation.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetAssessmentUseCase } from '../../../src/modules/course/application/get-assessment.use-case';
import { Assessment } from '../../../src/modules/course/domain/assessment.entity';
import { QuizQuestionFactory } from '../../../src/modules/course/domain/value-objects/quiz-question.vo';
import type { AssessmentRepository } from '../../../src/modules/course/domain/ports/assessment.repository';

const now = new Date('2025-01-01T00:00:00Z');
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };

function makeAssessmentRepo(overrides: Partial<AssessmentRepository> = {}): AssessmentRepository {
  return {
    upsert: vi.fn(),
    findById: vi.fn(),
    findByCourse: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe('GetAssessmentUseCase', () => {
  it('returns the assessment view for an existing quiz, threading ctx to findByCourse', async () => {
    const assessment = new Assessment({
      id: 'assess-1',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Quiz final',
      passingScore: 80,
      questions: [
        QuizQuestionFactory.create({
          type: 'single',
          id: 'q-1',
          prompt: '2 + 2?',
          options: [
            { id: 'opt-1', label: '3' },
            { id: 'opt-2', label: '4' },
          ],
          correctOptionId: 'opt-2',
        }),
      ],
      createdAt: now,
      updatedAt: now,
    });
    const assessmentRepo = makeAssessmentRepo({ findByCourse: vi.fn().mockResolvedValue(assessment) });
    const useCase = new GetAssessmentUseCase(assessmentRepo);

    const result = await useCase.execute(instructorCtx, 'course-1');

    expect(result).toEqual({
      id: 'assess-1',
      courseId: 'course-1',
      title: 'Quiz final',
      passingScore: 80,
      questions: assessment.questions,
    });
    expect(assessmentRepo.findByCourse).toHaveBeenCalledWith(instructorCtx, 'course-1');
  });

  it('returns null when the course has no assessment yet', async () => {
    const assessmentRepo = makeAssessmentRepo({ findByCourse: vi.fn().mockResolvedValue(null) });
    const useCase = new GetAssessmentUseCase(assessmentRepo);

    const result = await useCase.execute(instructorCtx, 'course-without-quiz');

    expect(result).toBeNull();
  });
});
