/**
 * UpsertAssessmentUseCase unit tests — fake repo (vi.fn()), no DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import { UpsertAssessmentUseCase } from '../../../src/modules/course/application/upsert-assessment.use-case';
import { InvalidQuizQuestionError } from '../../../src/modules/course/domain/errors';
import type { AssessmentRepository } from '../../../src/modules/course/domain/ports/assessment.repository';

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'admin' };
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };
const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

function makeValidQuestionInput(overrides: Record<string, unknown> = {}) {
  return {
    type: 'single' as const,
    id: 'q-1',
    prompt: 'What is 2 + 2?',
    options: [
      { id: 'opt-1', label: '3' },
      { id: 'opt-2', label: '4' },
    ],
    correctOptionId: 'opt-2',
    ...overrides,
  };
}

describe('UpsertAssessmentUseCase', () => {
  let assessmentRepo: AssessmentRepository;
  let useCase: UpsertAssessmentUseCase;

  beforeEach(() => {
    assessmentRepo = {
      upsert: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByCourse: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new UpsertAssessmentUseCase(assessmentRepo);
  });

  it('rejects a student (role gate)', async () => {
    await expect(
      useCase.execute(studentCtx, {
        id: 'assess-1',
        courseId: 'course-1',
        academyId: 'org_A',
        title: 'Quiz 1',
        questions: [],
      }),
    ).rejects.toThrow(UnauthorizedError);
    expect(assessmentRepo.upsert).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant write (input.academyId !== ctx.orgId) before calling the repo', async () => {
    await expect(
      useCase.execute(adminCtx, {
        id: 'assess-1',
        courseId: 'course-1',
        academyId: 'org_B',
        title: 'Evil Quiz',
        questions: [],
      }),
    ).rejects.toThrow(UnauthorizedError);
    expect(assessmentRepo.upsert).not.toHaveBeenCalled();
  });

  it('allows an admin to upsert a valid quiz', async () => {
    const assessment = await useCase.execute(adminCtx, {
      id: 'assess-1',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Quiz 1',
      questions: [makeValidQuestionInput()],
    });

    expect(assessment.courseId).toBe('course-1');
    expect(assessment.questions).toHaveLength(1);
    expect(assessmentRepo.upsert).toHaveBeenCalledOnce();
    expect(assessmentRepo.upsert).toHaveBeenCalledWith(adminCtx, expect.objectContaining({
      courseId: 'course-1',
    }));
  });

  it('allows an instructor to upsert a valid quiz', async () => {
    const assessment = await useCase.execute(instructorCtx, {
      id: 'assess-1',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Quiz 1',
      questions: [],
    });
    expect(assessment.questions).toEqual([]);
  });

  it('accepts an empty questions array (draft)', async () => {
    const assessment = await useCase.execute(adminCtx, {
      id: 'assess-1',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Quiz 1',
      questions: [],
    });
    expect(assessment.questions).toEqual([]);
  });

  it('bubbles InvalidQuizQuestionError before calling the repo (invalid raw question)', async () => {
    await expect(
      useCase.execute(adminCtx, {
        id: 'assess-1',
        courseId: 'course-1',
        academyId: 'org_A',
        title: 'Quiz 1',
        questions: [makeValidQuestionInput({ correctOptionId: 'opt-missing' })],
      }),
    ).rejects.toThrow(InvalidQuizQuestionError);
    expect(assessmentRepo.upsert).not.toHaveBeenCalled();
  });

  it('create-or-replace: a second upsert for the same courseId replaces questions', async () => {
    await useCase.execute(adminCtx, {
      id: 'assess-1',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Quiz 1',
      questions: [makeValidQuestionInput({ id: 'q-1' })],
    });

    const second = await useCase.execute(adminCtx, {
      id: 'assess-1',
      courseId: 'course-1',
      academyId: 'org_A',
      title: 'Quiz 1 updated',
      questions: [makeValidQuestionInput({ id: 'q-2', prompt: 'New question?' })],
    });

    expect(second.title).toBe('Quiz 1 updated');
    expect(second.questions).toHaveLength(1);
    expect(second.questions[0]?.id).toBe('q-2');
    expect(assessmentRepo.upsert).toHaveBeenCalledTimes(2);
  });
});
