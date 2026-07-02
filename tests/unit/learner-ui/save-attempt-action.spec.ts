/**
 * saveAttemptAction unit tests — the student quiz runner's Server Action.
 * Mirrors the same boundaries as mark-lesson-complete-action.spec.ts /
 * quiz-actions.spec.ts:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/course/composition'       → makeCourseComposition
 *
 * getTenantContext is called OUTSIDE the try (design.md's canonical
 * flow) — an unauthenticated caller should never reach submitAttempt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { QuizAttemptState } from '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_lib/quiz-attempt-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const submitAttemptExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    submitAttempt: { execute: submitAttemptExecuteMock },
  }),
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const courseId = 'course-1';

const initialState: QuizAttemptState = { ok: false, error: '' };

function formDataWith(payload: string): FormData {
  const fd = new FormData();
  fd.set('payload', payload);
  return fd;
}

function namedError(name: string): Error {
  const error = new Error(`${name} message`);
  error.name = name;
  return error;
}

const validAnswers = [
  { questionId: 'q-1', selectedOptionId: 'opt-2' },
  { questionId: 'q-2', selectedOptionId: 'opt-4' },
];

describe('saveAttemptAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    submitAttemptExecuteMock.mockReset();
  });

  it('submits the answers and returns {ok:true, score, passed} on success', async () => {
    submitAttemptExecuteMock.mockResolvedValue({ score: 80, passed: true });
    const { saveAttemptAction } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions'
    );

    const result = await saveAttemptAction(
      courseId,
      initialState,
      formDataWith(JSON.stringify(validAnswers)),
    );

    expect(result).toEqual({ ok: true, score: 80, passed: true });
    expect(submitAttemptExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ courseId, answers: validAnswers }),
    );
  });

  it('maps LearnerNotEnrolledError to the Spanish enrollment message', async () => {
    submitAttemptExecuteMock.mockRejectedValue(namedError('LearnerNotEnrolledError'));
    const { saveAttemptAction } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions'
    );

    const result = await saveAttemptAction(
      courseId,
      initialState,
      formDataWith(JSON.stringify(validAnswers)),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Necesitás estar inscripto para rendir la evaluación.',
    });
  });

  it('maps EmptyQuizError to the Spanish empty-quiz message', async () => {
    submitAttemptExecuteMock.mockRejectedValue(namedError('EmptyQuizError'));
    const { saveAttemptAction } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions'
    );

    const result = await saveAttemptAction(
      courseId,
      initialState,
      formDataWith(JSON.stringify(validAnswers)),
    );

    expect(result).toEqual({ ok: false, error: 'La evaluación todavía no tiene preguntas.' });
  });

  it('maps InvalidAttemptError to the Spanish invalid-attempt message', async () => {
    submitAttemptExecuteMock.mockRejectedValue(namedError('InvalidAttemptError'));
    const { saveAttemptAction } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions'
    );

    const result = await saveAttemptAction(
      courseId,
      initialState,
      formDataWith(JSON.stringify(validAnswers)),
    );

    expect(result).toEqual({ ok: false, error: 'Las respuestas enviadas no son válidas.' });
  });

  it('returns a generic error for a malformed (non-JSON) payload, without calling the use-case', async () => {
    const { saveAttemptAction } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions'
    );

    const result = await saveAttemptAction(courseId, initialState, formDataWith('{not json'));

    expect(result).toEqual({ ok: false, error: 'Ocurrió un error. Intentá de nuevo.' });
    expect(submitAttemptExecuteMock).not.toHaveBeenCalled();
  });

  it('rejects an empty answers array with a Spanish validation message, without calling the use-case', async () => {
    const { saveAttemptAction } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions'
    );

    const result = await saveAttemptAction(
      courseId,
      initialState,
      formDataWith(JSON.stringify([])),
    );

    expect(result).toEqual({ ok: false, error: 'Debés responder todas las preguntas.' });
    expect(submitAttemptExecuteMock).not.toHaveBeenCalled();
  });

  it('calls getTenantContext even before parsing the payload', async () => {
    const { saveAttemptAction } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions'
    );

    await saveAttemptAction(courseId, initialState, formDataWith('{not json'));

    expect(getTenantContextMock).toHaveBeenCalledOnce();
  });
});
