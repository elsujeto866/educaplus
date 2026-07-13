/**
 * Track authoring Server Action unit tests — createTrackAction,
 * addTrackStepAction, removeTrackStepAction, reorderTrackStepUpAction,
 * reorderTrackStepDownAction. Mirrors `bank-actions.spec.ts` (create +
 * redirect, ActionResult rejection) and `module-actions.spec.ts` (reorder
 * via a load-current-order-then-swap-then-persist round trip) mocking
 * strategy — composition, next/cache, next/navigation all mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/simulators/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const createTrackExecuteMock = vi.fn();
const addSimulatorToTrackStepExecuteMock = vi.fn();
const removeTrackStepExecuteMock = vi.fn();
const reorderTrackStepsExecuteMock = vi.fn();
const getTrackDetailExecuteMock = vi.fn();
const publishTrackExecuteMock = vi.fn();
const unpublishTrackExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    createTrack: { execute: createTrackExecuteMock },
    addSimulatorToTrackStep: { execute: addSimulatorToTrackStepExecuteMock },
    removeTrackStep: { execute: removeTrackStepExecuteMock },
    reorderTrackSteps: { execute: reorderTrackStepsExecuteMock },
    getTrackDetail: { execute: getTrackDetailExecuteMock },
    publishTrack: { execute: publishTrackExecuteMock },
    unpublishTrack: { execute: unpublishTrackExecuteMock },
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
const trackId = 'track-1';

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: ActionResult = { ok: true };

beforeEach(() => {
  getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
  createTrackExecuteMock.mockReset();
  addSimulatorToTrackStepExecuteMock.mockReset();
  removeTrackStepExecuteMock.mockReset();
  reorderTrackStepsExecuteMock.mockReset();
  getTrackDetailExecuteMock.mockReset();
  publishTrackExecuteMock.mockReset();
  unpublishTrackExecuteMock.mockReset();
  revalidatePathMock.mockClear();
  redirectMock.mockClear();
});

describe('createTrackAction', () => {
  it('rejects a title shorter than 3 characters WITHOUT calling getTenantContext', async () => {
    const { createTrackAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    const result = await createTrackAction(initialState, formDataWith({ title: 'ab' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(createTrackExecuteMock).not.toHaveBeenCalled();
  });

  it('creates the track, revalidates the list, and redirects to the track builder', async () => {
    createTrackExecuteMock.mockResolvedValue({ id: 'track-new' });
    const { createTrackAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    await expect(
      createTrackAction(initialState, formDataWith({ title: 'Ruta de matemática' })),
    ).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(createTrackExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ academyId: instructorCtx.orgId, title: 'Ruta de matemática' }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/simulators/tracks');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/simulators/tracks/track-new');
  });
});

describe('addTrackStepAction', () => {
  it('rejects a blank simulatorId WITHOUT calling getTenantContext', async () => {
    const { addTrackStepAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    const result = await addTrackStepAction(trackId, initialState, formDataWith({ simulatorId: '' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(addSimulatorToTrackStepExecuteMock).not.toHaveBeenCalled();
  });

  it('adds the step and revalidates the track builder page (no redirect)', async () => {
    addSimulatorToTrackStepExecuteMock.mockResolvedValue({ id: 'step-new' });
    const { addTrackStepAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    const result = await addTrackStepAction(trackId, initialState, formDataWith({ simulatorId: 'sim-1' }));

    expect(result).toEqual({ ok: true });
    expect(addSimulatorToTrackStepExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({ trackId, academyId: instructorCtx.orgId, simulatorId: 'sim-1' }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/tracks/${trackId}`);
  });

  it('maps SimulatorNotPublishedError to a Spanish ActionResult', async () => {
    const notPublished = new Error('Simulator "sim-1" is not published and cannot be added to a track');
    notPublished.name = 'SimulatorNotPublishedError';
    addSimulatorToTrackStepExecuteMock.mockRejectedValue(notPublished);
    const { addTrackStepAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    const result = await addTrackStepAction(trackId, initialState, formDataWith({ simulatorId: 'sim-1' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(result.ok).toBe(false);
  });

  it('maps SimulatorAlreadyInTrackError to a Spanish ActionResult', async () => {
    const alreadyInTrack = new Error('Simulator "sim-1" is already assigned to a track');
    alreadyInTrack.name = 'SimulatorAlreadyInTrackError';
    addSimulatorToTrackStepExecuteMock.mockRejectedValue(alreadyInTrack);
    const { addTrackStepAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    const result = await addTrackStepAction(trackId, initialState, formDataWith({ simulatorId: 'sim-1' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(result.ok).toBe(false);
  });
});

describe('removeTrackStepAction', () => {
  it('removes the step and revalidates the track builder page (fire-and-forget)', async () => {
    removeTrackStepExecuteMock.mockResolvedValue([]);
    const { removeTrackStepAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    await removeTrackStepAction(trackId, 'step-1', new FormData());

    expect(removeTrackStepExecuteMock).toHaveBeenCalledWith(instructorCtx, { trackId, stepId: 'step-1' });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/tracks/${trackId}`);
  });
});

describe('reorderTrackStepUpAction', () => {
  it('loads the current step order, swaps the target up, and calls reorderTrackSteps', async () => {
    getTrackDetailExecuteMock.mockResolvedValue({
      track: { id: trackId },
      steps: [{ id: 's-1' }, { id: 's-2' }, { id: 's-3' }],
    });
    const { reorderTrackStepUpAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    await reorderTrackStepUpAction(trackId, 's-2', new FormData());

    expect(reorderTrackStepsExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      trackId,
      orderedStepIds: ['s-2', 's-1', 's-3'],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/tracks/${trackId}`);
  });

  it('does NOT call reorderTrackSteps when the target is already first (no-op)', async () => {
    getTrackDetailExecuteMock.mockResolvedValue({
      track: { id: trackId },
      steps: [{ id: 's-1' }, { id: 's-2' }],
    });
    const { reorderTrackStepUpAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    await reorderTrackStepUpAction(trackId, 's-1', new FormData());

    expect(reorderTrackStepsExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/tracks/${trackId}`);
  });
});

describe('reorderTrackStepDownAction', () => {
  it('loads the current step order, swaps the target down, and calls reorderTrackSteps', async () => {
    getTrackDetailExecuteMock.mockResolvedValue({
      track: { id: trackId },
      steps: [{ id: 's-1' }, { id: 's-2' }, { id: 's-3' }],
    });
    const { reorderTrackStepDownAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    await reorderTrackStepDownAction(trackId, 's-2', new FormData());

    expect(reorderTrackStepsExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      trackId,
      orderedStepIds: ['s-1', 's-3', 's-2'],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/tracks/${trackId}`);
  });
});

describe('publishTrackAction', () => {
  it('publishes and revalidates the track builder page on success', async () => {
    publishTrackExecuteMock.mockResolvedValue({ id: trackId, status: 'published' });
    const { publishTrackAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    const result = await publishTrackAction(trackId, initialState, new FormData());

    expect(result).toEqual({ ok: true });
    expect(publishTrackExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: trackId });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/tracks/${trackId}`);
  });

  it('maps EmptyTrackError to a Spanish ActionResult (empty-track publish guard)', async () => {
    const empty = new Error('Simulator track "track-1" has no steps and cannot be published');
    empty.name = 'EmptyTrackError';
    publishTrackExecuteMock.mockRejectedValue(empty);
    const { publishTrackAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    const result = await publishTrackAction(trackId, initialState, new FormData());

    expect(result).toEqual({
      ok: false,
      error: 'Esta ruta de estudio todavía no tiene pasos y no se puede publicar.',
    });
  });
});

describe('unpublishTrackAction', () => {
  it('unpublishes and revalidates the track builder page (fire-and-forget, no rejection path)', async () => {
    unpublishTrackExecuteMock.mockResolvedValue({ id: trackId, status: 'draft' });
    const { unpublishTrackAction } = await import('../../../src/app/dashboard/simulators/tracks/actions');

    await unpublishTrackAction(trackId, new FormData());

    expect(unpublishTrackExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: trackId });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/simulators/tracks/${trackId}`);
  });
});
