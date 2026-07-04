/**
 * Bank Server Action unit tests — createBankAction / updateBankAction /
 * deleteBankAction. Mirrors `tests/unit/course-authoring-ui/create-course-action.spec.ts`'s
 * mocking strategy (composition, next/cache, next/navigation all mocked).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/simulators/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const createBankExecuteMock = vi.fn();
const updateBankExecuteMock = vi.fn();
const deleteBankExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    createBank: { execute: createBankExecuteMock },
    updateBank: { execute: updateBankExecuteMock },
    deleteBank: { execute: deleteBankExecuteMock },
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

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: ActionResult = { ok: true };

describe('createBankAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    createBankExecuteMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it('rejects a title shorter than 3 characters WITHOUT calling getTenantContext', async () => {
    const { createBankAction } = await import('../../../src/app/dashboard/simulators/actions');

    const result = await createBankAction(initialState, formDataWith({ title: 'ab' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(createBankExecuteMock).not.toHaveBeenCalled();
  });

  it('creates the bank, revalidates the list, and redirects to the bank detail page', async () => {
    createBankExecuteMock.mockResolvedValue({ id: 'bank-new' });
    const { createBankAction } = await import('../../../src/app/dashboard/simulators/actions');

    await expect(
      createBankAction(initialState, formDataWith({ title: 'Historia argentina' })),
    ).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(createBankExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ academyId: instructorCtx.orgId, title: 'Historia argentina' }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/simulators/banks/bank-new');
  });
});

describe('deleteBankAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    deleteBankExecuteMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it('maps QuestionBankInUseError to a Spanish ActionResult and does NOT redirect', async () => {
    const inUse = new Error('Question bank "bank-1" is bound to at least one simulator');
    inUse.name = 'QuestionBankInUseError';
    deleteBankExecuteMock.mockRejectedValue(inUse);
    const { deleteBankAction } = await import('../../../src/app/dashboard/simulators/actions');

    const result = await deleteBankAction('bank-1', initialState, new FormData());

    expect(result).toEqual({
      ok: false,
      error: 'Este banco está en uso por un simulacro y no se puede eliminar.',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('deletes the bank and redirects to the list on success', async () => {
    deleteBankExecuteMock.mockResolvedValue(undefined);
    const { deleteBankAction } = await import('../../../src/app/dashboard/simulators/actions');

    await expect(deleteBankAction('bank-1', initialState, new FormData())).rejects.toBeInstanceOf(
      FakeRedirectSignal,
    );

    expect(deleteBankExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: 'bank-1' });
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/simulators');
  });
});
