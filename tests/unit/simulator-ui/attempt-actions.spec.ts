/**
 * startAttemptAction / submitAttemptAction unit tests — Slice S4
 * (Attempt-Taking). Mirrors `simulator-create-action.spec.ts`'s mocking
 * strategy (composition, next/navigation mocked; getTenantContext mocked).
 *
 * Covers the ABUSE cases at the Server Action boundary: attempt-limit
 * rejection surfaces as an inline Spanish error (not a crash), and a
 * rejected submit (double-submit / invalid answers) never redirects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/simulators/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const startAttemptExecuteMock = vi.fn();
const submitAttemptExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    startAttempt: { execute: startAttemptExecuteMock },
    // `startAttemptAction` now calls `startTrackStepAttempt` (the guarded,
    // track-lock-aware entry) instead of the raw `startAttempt` — see
    // `[simulatorId]/actions.ts`. It is a transparent pass-through for
    // standalone simulators, so this mock reuses the SAME
    // `startAttemptExecuteMock`/assertions below unchanged: this test still
    // proves the exact same standalone start/redirect and
    // AttemptLimitReachedError-mapping behavior, just through the
    // re-pointed composition entry. Additive fixture completion only — no
    // assertions in this file were changed.
    startTrackStepAttempt: { execute: startAttemptExecuteMock },
    submitAttempt: { execute: submitAttemptExecuteMock },
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

describe('startAttemptAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    startAttemptExecuteMock.mockReset();
    redirectMock.mockClear();
  });

  it('starts the attempt and redirects to the attempt page on success', async () => {
    startAttemptExecuteMock.mockResolvedValue({ id: 'attempt-1' });
    const { startAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/actions'
    );

    await expect(
      startAttemptAction('sim-1', initialState, new FormData()),
    ).rejects.toThrow(FakeRedirectSignal);

    expect(startAttemptExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ simulatorId: 'sim-1' }),
    );
    expect(redirectMock).toHaveBeenCalledWith(
      '/dashboard/learn/simulators/sim-1/attempt/attempt-1',
    );
  });

  it('ABUSE CASE — maps AttemptLimitReachedError to a Spanish ActionResult (never a crash, never a redirect)', async () => {
    const limitReached = new Error('attempt limit reached');
    limitReached.name = 'AttemptLimitReachedError';
    startAttemptExecuteMock.mockRejectedValue(limitReached);
    const { startAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/actions'
    );

    const result = await startAttemptAction('sim-1', initialState, new FormData());

    expect(result).toEqual({
      ok: false,
      error: 'Ya alcanzaste el límite de intentos permitidos para este simulador.',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('submitAttemptAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    submitAttemptExecuteMock.mockReset();
  });

  function payloadFormData(answers: { questionId: string; selectedOptionId: string }[]): FormData {
    const fd = new FormData();
    fd.set('payload', JSON.stringify(answers));
    return fd;
  }

  it('submits the answers and returns the score/passed/status result', async () => {
    submitAttemptExecuteMock.mockResolvedValue({ score: 100, passed: true, status: 'submitted' });
    const { submitAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/actions'
    );

    const result = await submitAttemptAction(
      'attempt-1',
      { ok: false, error: '' },
      payloadFormData([{ questionId: 'q-1', selectedOptionId: 'opt-2' }]),
    );

    expect(result).toEqual({ ok: true, score: 100, passed: true, status: 'submitted' });
    expect(submitAttemptExecuteMock).toHaveBeenCalledWith(studentCtx, {
      attemptId: 'attempt-1',
      answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
    });
  });

  it('ABUSE CASE — maps AttemptAlreadySubmittedError (double-submit) to a Spanish error, no crash', async () => {
    const already = new Error('already submitted');
    already.name = 'AttemptAlreadySubmittedError';
    submitAttemptExecuteMock.mockRejectedValue(already);
    const { submitAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/actions'
    );

    const result = await submitAttemptAction(
      'attempt-1',
      { ok: false, error: '' },
      payloadFormData([{ questionId: 'q-1', selectedOptionId: 'opt-2' }]),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Este intento ya fue entregado y no se puede volver a enviar.',
    });
  });

  it('ABUSE CASE — maps InvalidAttemptAnswersError (foreign/duplicate answer injection) to a Spanish error', async () => {
    const invalid = new Error('invalid answers');
    invalid.name = 'InvalidAttemptAnswersError';
    submitAttemptExecuteMock.mockRejectedValue(invalid);
    const { submitAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/actions'
    );

    const result = await submitAttemptAction(
      'attempt-1',
      { ok: false, error: '' },
      payloadFormData([{ questionId: 'foreign', selectedOptionId: 'x' }]),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Las respuestas enviadas no son válidas para este intento.',
    });
  });

  it('accepts an EMPTY answers payload (partial/no-answer submission is valid)', async () => {
    submitAttemptExecuteMock.mockResolvedValue({ score: 0, passed: false, status: 'submitted' });
    const { submitAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/actions'
    );

    const result = await submitAttemptAction('attempt-1', { ok: false, error: '' }, payloadFormData([]));

    expect(result).toEqual({ ok: true, score: 0, passed: false, status: 'submitted' });
  });
});
