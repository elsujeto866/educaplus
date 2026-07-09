/**
 * startTrackStepAttemptAction unit tests — Phase 6 (locked-step gate,
 * track-context start path). Mirrors `attempt-actions.spec.ts`'s mocking
 * strategy (composition, next/navigation mocked; getTenantContext mocked).
 *
 * Delegates to `startTrackStepAttempt` (NOT `startAttempt`) — the gated
 * composition entry point (`StartTrackStepAttemptUseCase`), which composes
 * around the shipped, untouched `StartAttemptUseCase`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/simulators/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const startTrackStepAttemptExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    startTrackStepAttempt: { execute: startTrackStepAttemptExecuteMock },
  }),
}));

class FakeRedirectSignal extends Error {}
const redirectMock = vi.fn((_path: string) => {
  throw new FakeRedirectSignal('NEXT_REDIRECT');
});
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

const initialState: ActionResult = { ok: true };

describe('startTrackStepAttemptAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    startTrackStepAttemptExecuteMock.mockReset();
    redirectMock.mockClear();
  });

  it('starts the attempt via the GUARDED composition entry and redirects to the (shared) attempt page', async () => {
    startTrackStepAttemptExecuteMock.mockResolvedValue({ id: 'attempt-1' });
    const { startTrackStepAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/tracks/[trackId]/actions'
    );

    await expect(
      startTrackStepAttemptAction('sim-2', initialState, new FormData()),
    ).rejects.toThrow(FakeRedirectSignal);

    expect(startTrackStepAttemptExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ simulatorId: 'sim-2' }),
    );
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/learn/simulators/sim-2/attempt/attempt-1');
  });

  it('LOCKED STEP — maps StepLockedError to a Spanish ActionResult (never a crash, never a redirect)', async () => {
    const locked = new Error('locked');
    locked.name = 'StepLockedError';
    startTrackStepAttemptExecuteMock.mockRejectedValue(locked);
    const { startTrackStepAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/tracks/[trackId]/actions'
    );

    const result = await startTrackStepAttemptAction('sim-2', initialState, new FormData());

    expect(result).toEqual({
      ok: false,
      error: 'Todavía no desbloqueaste este paso. Superá el paso anterior primero.',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
