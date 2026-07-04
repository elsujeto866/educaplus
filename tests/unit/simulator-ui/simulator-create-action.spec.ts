/**
 * createSimulatorAction unit tests — mirrors `bank-actions.spec.ts`'s
 * mocking strategy (composition, next/cache, next/navigation all mocked).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/simulators/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const createSimulatorExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    createSimulator: { execute: createSimulatorExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

class FakeRedirectSignal extends Error {}
const redirectMock = vi.fn((_path: string) => {
  throw new FakeRedirectSignal('NEXT_REDIRECT');
});
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'instructor' };

function formDataWith(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

const initialState: ActionResult = { ok: true };

describe('createSimulatorAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    createSimulatorExecuteMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it('rejects a title shorter than 3 characters WITHOUT calling getTenantContext', async () => {
    const { createSimulatorAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/simulators/actions'
    );

    const result = await createSimulatorAction(
      'bank-1',
      initialState,
      formDataWith({
        title: 'ab',
        questionCount: '5',
        passingScore: '70',
        timeLimitMinutes: '30',
        attemptLimit: '3',
      }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(createSimulatorExecuteMock).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric questionCount', async () => {
    const { createSimulatorAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/simulators/actions'
    );

    const result = await createSimulatorAction(
      'bank-1',
      initialState,
      formDataWith({
        title: 'Simulacro válido',
        questionCount: 'abc',
        passingScore: '70',
        timeLimitMinutes: '30',
        attemptLimit: '3',
      }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(createSimulatorExecuteMock).not.toHaveBeenCalled();
  });

  it('creates the simulator, revalidates, and redirects to the edit page', async () => {
    createSimulatorExecuteMock.mockResolvedValue({ id: 'sim-new' });
    const { createSimulatorAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/simulators/actions'
    );

    await expect(
      createSimulatorAction(
        'bank-1',
        initialState,
        formDataWith({
          title: 'Simulacro final',
          questionCount: '10',
          passingScore: '70',
          timeLimitMinutes: '45',
          attemptLimit: '3',
          topics: ['algebra', 'geometria'],
        }),
      ),
    ).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(createSimulatorExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        academyId: instructorCtx.orgId,
        bankId: 'bank-1',
        title: 'Simulacro final',
        questionCount: 10,
        passingScore: 70,
        timeLimitMinutes: 45,
        attemptLimit: 3,
        topicFilter: ['algebra', 'geometria'],
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/simulators/sim-new/edit');
  });

  it('sends topicFilter=null when no topics are selected', async () => {
    createSimulatorExecuteMock.mockResolvedValue({ id: 'sim-new-2' });
    const { createSimulatorAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/simulators/actions'
    );

    await expect(
      createSimulatorAction(
        'bank-1',
        initialState,
        formDataWith({
          title: 'Simulacro sin filtro',
          questionCount: '10',
          passingScore: '70',
          timeLimitMinutes: '45',
          attemptLimit: '3',
        }),
      ),
    ).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(createSimulatorExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ topicFilter: null }),
    );
  });

  it('maps QuestionBankNotFoundError to a Spanish ActionResult and does NOT redirect', async () => {
    const notFound = new Error('Question bank "bank-1" does not exist');
    notFound.name = 'QuestionBankNotFoundError';
    createSimulatorExecuteMock.mockRejectedValue(notFound);
    const { createSimulatorAction } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/simulators/actions'
    );

    const result = await createSimulatorAction(
      'bank-1',
      initialState,
      formDataWith({
        title: 'Simulacro válido',
        questionCount: '10',
        passingScore: '70',
        timeLimitMinutes: '45',
        attemptLimit: '3',
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: 'El banco de preguntas no existe o no tenés acceso a él.',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
