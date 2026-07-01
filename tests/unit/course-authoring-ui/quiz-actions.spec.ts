/**
 * saveQuizAction unit tests — the quiz builder's Server Action.
 *
 * Mocks the same boundaries as module-actions.spec.ts:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/course/composition'       → makeCourseComposition
 *  - 'next/cache'                          → revalidatePath
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';
import { serializeQuizPayload } from '../../../src/app/dashboard/courses/[courseId]/quiz/_lib/quiz-form';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const upsertAssessmentExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    upsertAssessment: { execute: upsertAssessmentExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'instructor' };
const courseId = 'course-1';

const validQuestion = {
  id: 'q-1',
  prompt: '2 + 2?',
  options: [
    { id: 'opt-1', label: '3' },
    { id: 'opt-2', label: '4' },
  ],
  correctOptionId: 'opt-2',
};

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: ActionResult = { ok: true };

beforeEach(() => {
  getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
  upsertAssessmentExecuteMock.mockReset();
  revalidatePathMock.mockClear();
});

describe('saveQuizAction', () => {
  it('rejects an invalid title WITHOUT calling getTenantContext or the use-case', async () => {
    const { saveQuizAction } = await import(
      '../../../src/app/dashboard/courses/[courseId]/quiz/actions'
    );

    const result = await saveQuizAction(
      courseId,
      initialState,
      formDataWith({ title: 'ab', payload: serializeQuizPayload([]) }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(upsertAssessmentExecuteMock).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON in the payload field with an invalid-format message', async () => {
    const { saveQuizAction } = await import(
      '../../../src/app/dashboard/courses/[courseId]/quiz/actions'
    );

    const result = await saveQuizAction(
      courseId,
      initialState,
      formDataWith({ title: 'Evaluación final', payload: '{not json' }),
    );

    expect(result).toEqual({ ok: false, error: 'El cuestionario tiene un formato inválido.' });
    expect(upsertAssessmentExecuteMock).not.toHaveBeenCalled();
  });

  it('maps a domain InvalidQuizQuestionError thrown by the use-case to a Spanish message', async () => {
    const domainError = new Error('bad question');
    domainError.name = 'InvalidQuizQuestionError';
    upsertAssessmentExecuteMock.mockRejectedValue(domainError);
    const { saveQuizAction } = await import(
      '../../../src/app/dashboard/courses/[courseId]/quiz/actions'
    );

    const result = await saveQuizAction(
      courseId,
      initialState,
      formDataWith({ title: 'Evaluación final', payload: serializeQuizPayload([validQuestion]) }),
    );

    expect(result).toEqual({ ok: false, error: 'La pregunta del cuestionario no es válida.' });
  });

  it('saves a valid draft: calls upsertAssessment once with the mapped payload, revalidates, and returns ok', async () => {
    upsertAssessmentExecuteMock.mockResolvedValue({ id: 'assess-1' });
    const { saveQuizAction } = await import(
      '../../../src/app/dashboard/courses/[courseId]/quiz/actions'
    );

    const result = await saveQuizAction(
      courseId,
      initialState,
      formDataWith({ title: 'Evaluación final', payload: serializeQuizPayload([validQuestion]) }),
    );

    expect(result).toEqual({ ok: true });
    expect(upsertAssessmentExecuteMock).toHaveBeenCalledOnce();
    expect(upsertAssessmentExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        courseId,
        academyId: instructorCtx.orgId,
        title: 'Evaluación final',
        questions: [{ type: 'single', ...validQuestion }],
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}/quiz`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });

  it('saves an empty draft (0 questions) successfully — empty quiz is a valid submit', async () => {
    upsertAssessmentExecuteMock.mockResolvedValue({ id: 'assess-1' });
    const { saveQuizAction } = await import(
      '../../../src/app/dashboard/courses/[courseId]/quiz/actions'
    );

    const result = await saveQuizAction(
      courseId,
      initialState,
      formDataWith({ title: 'Evaluación final', payload: serializeQuizPayload([]) }),
    );

    expect(result).toEqual({ ok: true });
    expect(upsertAssessmentExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ questions: [] }),
    );
  });
});
