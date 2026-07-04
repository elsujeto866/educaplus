/**
 * updateSimulatorAction / publishSimulatorAction / unpublishSimulatorAction
 * unit tests — mirrors `simulator-create-action.spec.ts`'s mocking strategy.
 *
 * publishSimulatorAction uses `useActionState` (unlike course's
 * fire-and-forget publish/unpublish) because `PublishSimulatorUseCase` has
 * a real, user-facing rejection path (spec.md "Bank has fewer questions
 * than required") that must surface an inline Spanish message — same
 * rationale as `deleteBankAction` in Slice S2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/simulators/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const updateSimulatorExecuteMock = vi.fn();
const publishSimulatorExecuteMock = vi.fn();
const unpublishSimulatorExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    updateSimulator: { execute: updateSimulatorExecuteMock },
    publishSimulator: { execute: publishSimulatorExecuteMock },
    unpublishSimulator: { execute: unpublishSimulatorExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
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

describe('updateSimulatorAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    updateSimulatorExecuteMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('rejects a title shorter than 3 characters WITHOUT calling getTenantContext', async () => {
    const { updateSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    const result = await updateSimulatorAction(
      'sim-1',
      initialState,
      formDataWith({ title: 'ab', questionCount: '5', passingScore: '70', timeLimitMinutes: '30', attemptLimit: '3' }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
  });

  it('updates the simulator and stays on the edit page (no redirect)', async () => {
    updateSimulatorExecuteMock.mockResolvedValue({ id: 'sim-1' });
    const { updateSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    const result = await updateSimulatorAction(
      'sim-1',
      initialState,
      formDataWith({
        title: 'Simulacro actualizado',
        questionCount: '8',
        passingScore: '80',
        timeLimitMinutes: '40',
        attemptLimit: '2',
        topics: ['algebra'],
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateSimulatorExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        id: 'sim-1',
        title: 'Simulacro actualizado',
        questionCount: 8,
        passingScore: 80,
        timeLimitMinutes: 40,
        attemptLimit: 2,
        topicFilter: ['algebra'],
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators/sim-1/edit');
  });

  it('sends issuesCertificate=true when the checkbox is present (checked, Slice S6)', async () => {
    updateSimulatorExecuteMock.mockResolvedValue({ id: 'sim-1' });
    const { updateSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    await updateSimulatorAction(
      'sim-1',
      initialState,
      formDataWith({
        title: 'Simulacro actualizado',
        questionCount: '8',
        passingScore: '80',
        timeLimitMinutes: '40',
        attemptLimit: '2',
        issuesCertificate: 'on',
      }),
    );

    expect(updateSimulatorExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ issuesCertificate: true }),
    );
  });

  it('sends issuesCertificate=false when the checkbox is absent (unchecked, Slice S6)', async () => {
    updateSimulatorExecuteMock.mockResolvedValue({ id: 'sim-1' });
    const { updateSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    await updateSimulatorAction(
      'sim-1',
      initialState,
      formDataWith({
        title: 'Simulacro actualizado',
        questionCount: '8',
        passingScore: '80',
        timeLimitMinutes: '40',
        attemptLimit: '2',
      }),
    );

    expect(updateSimulatorExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ issuesCertificate: false }),
    );
  });

  it('maps SimulatorNotFoundError to a Spanish ActionResult', async () => {
    const notFound = new Error('Simulator "sim-1" does not exist');
    notFound.name = 'SimulatorNotFoundError';
    updateSimulatorExecuteMock.mockRejectedValue(notFound);
    const { updateSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    const result = await updateSimulatorAction(
      'sim-1',
      initialState,
      formDataWith({
        title: 'Simulacro válido',
        questionCount: '8',
        passingScore: '80',
        timeLimitMinutes: '40',
        attemptLimit: '2',
      }),
    );

    expect(result).toEqual({ ok: false, error: 'El simulacro no existe o no tenés acceso a él.' });
  });
});

describe('publishSimulatorAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    publishSimulatorExecuteMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('maps InsufficientQuestionPoolError to a Spanish ActionResult (spec.md)', async () => {
    const insufficient = new Error('Simulator "sim-1" requires 10 question(s) but its bank only has 3');
    insufficient.name = 'InsufficientQuestionPoolError';
    publishSimulatorExecuteMock.mockRejectedValue(insufficient);
    const { publishSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    const result = await publishSimulatorAction('sim-1', initialState, new FormData());

    expect(result).toEqual({
      ok: false,
      error: 'El banco no tiene suficientes preguntas para publicar este simulacro con la configuración actual.',
    });
  });

  it('publishes and revalidates the edit page on success', async () => {
    publishSimulatorExecuteMock.mockResolvedValue({ id: 'sim-1', status: 'published' });
    const { publishSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    const result = await publishSimulatorAction('sim-1', initialState, new FormData());

    expect(result).toEqual({ ok: true });
    expect(publishSimulatorExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: 'sim-1' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators/sim-1/edit');
  });
});

describe('unpublishSimulatorAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    unpublishSimulatorExecuteMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('unpublishes and revalidates the edit page (fire-and-forget, no rejection path)', async () => {
    unpublishSimulatorExecuteMock.mockResolvedValue({ id: 'sim-1', status: 'draft' });
    const { unpublishSimulatorAction } = await import('../../../src/app/dashboard/simulators/[simulatorId]/actions');

    await unpublishSimulatorAction('sim-1', new FormData());

    expect(unpublishSimulatorExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: 'sim-1' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators/sim-1/edit');
  });
});
