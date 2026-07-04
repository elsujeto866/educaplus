/**
 * Question Server Action unit tests — addQuestionAction / deleteQuestionAction.
 * Mirrors `tests/unit/simulator-ui/bank-actions.spec.ts`'s mocking strategy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/simulators/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const addQuestionExecuteMock = vi.fn();
const deleteQuestionExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    addQuestion: { execute: addQuestionExecuteMock },
    deleteQuestion: { execute: deleteQuestionExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'instructor' };

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: ActionResult = { ok: true };

describe('addQuestionAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    addQuestionExecuteMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects a malformed options payload WITHOUT calling getTenantContext', async () => {
    const { addQuestionAction } = await import('../../../src/app/dashboard/simulators/banks/[bankId]/actions');

    const result = await addQuestionAction(
      'bank-1',
      initialState,
      formDataWith({ prompt: '¿Capital de Francia?', optionsPayload: 'not json' }),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Las opciones de la pregunta tienen un formato inválido.',
    });
    expect(getTenantContextMock).not.toHaveBeenCalled();
  });

  it('adds the question and revalidates the bank detail page', async () => {
    addQuestionExecuteMock.mockResolvedValue({ id: 'question-new' });
    const { addQuestionAction } = await import('../../../src/app/dashboard/simulators/banks/[bankId]/actions');

    const optionsPayload = JSON.stringify({
      options: [
        { id: 'opt-a', label: 'Madrid' },
        { id: 'opt-b', label: 'París' },
      ],
      correctOptionId: 'opt-b',
    });

    const result = await addQuestionAction(
      'bank-1',
      initialState,
      formDataWith({ prompt: '¿Capital de Francia?', topic: 'geografía', optionsPayload }),
    );

    expect(result).toEqual({ ok: true });
    expect(addQuestionExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        bankId: 'bank-1',
        academyId: instructorCtx.orgId,
        prompt: '¿Capital de Francia?',
        topic: 'geografía',
        correctOptionId: 'opt-b',
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators/banks/bank-1');
  });

  it('maps a domain InvalidQuestionError thrown by the use-case to a Spanish ActionResult', async () => {
    const invalid = new Error('Invalid question: correctOptionId does not match any option');
    invalid.name = 'InvalidQuestionError';
    addQuestionExecuteMock.mockRejectedValue(invalid);
    const { addQuestionAction } = await import('../../../src/app/dashboard/simulators/banks/[bankId]/actions');

    const optionsPayload = JSON.stringify({
      options: [
        { id: 'opt-a', label: 'A' },
        { id: 'opt-b', label: 'B' },
      ],
      correctOptionId: 'opt-a',
    });

    const result = await addQuestionAction(
      'bank-1',
      initialState,
      formDataWith({ prompt: 'Pregunta', optionsPayload }),
    );

    expect(result).toEqual({
      ok: false,
      error: 'La pregunta no es válida. Verificá las opciones y la respuesta correcta.',
    });
  });
});

describe('deleteQuestionAction', () => {
  it('calls the use-case and revalidates the bank detail page', async () => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    deleteQuestionExecuteMock.mockReset().mockResolvedValue(undefined);
    revalidatePathMock.mockClear();
    const { deleteQuestionAction } = await import('../../../src/app/dashboard/simulators/banks/[bankId]/actions');

    await deleteQuestionAction('bank-1', 'question-1', new FormData());

    expect(deleteQuestionExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: 'question-1' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators/banks/bank-1');
  });
});
