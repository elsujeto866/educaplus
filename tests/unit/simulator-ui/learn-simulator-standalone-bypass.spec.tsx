/**
 * Standalone-catalog/detail BYPASS fix tests — Phase 6.
 *
 * The shipped `startAttemptAction` has NO track-lock check (Slice S4
 * predates tracks). A simulator that is a track step could otherwise be
 * reached — and started — via the standalone learner flow, bypassing the
 * locked-step gate entirely. Rather than editing `startAttemptAction.ts` or
 * `StartAttemptUseCase` (which would require rewriting their shipped
 * regression tests — explicitly forbidden), this closes the gap by
 * excluding ANY track-step simulator from the standalone catalog AND detail
 * routes (both previously untested, zero shipped-test risk) — forcing
 * learners through the gated track level-map instead.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const listPublishedSimulatorsExecuteMock = vi.fn();
const getPublishedSimulatorExecuteMock = vi.fn();
const getTrackStepBySimulatorExecuteMock = vi.fn();
const startAttemptExecuteMock = vi.fn();
const startTrackStepAttemptExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    listPublishedSimulators: { execute: listPublishedSimulatorsExecuteMock },
    getPublishedSimulator: { execute: getPublishedSimulatorExecuteMock },
    getTrackStepBySimulator: { execute: getTrackStepBySimulatorExecuteMock },
    startAttempt: { execute: startAttemptExecuteMock },
    startTrackStepAttempt: { execute: startTrackStepAttemptExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

class FakeNotFoundSignal extends Error {}
const notFoundMock = vi.fn(() => {
  throw new FakeNotFoundSignal('NEXT_NOT_FOUND');
});
class FakeRedirectSignal extends Error {}
const redirectMock = vi.fn((_path: string) => {
  throw new FakeRedirectSignal('NEXT_REDIRECT');
});
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
  redirect: (path: string) => redirectMock(path),
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

describe('Standalone learner catalog — track-step bypass fix', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    listPublishedSimulatorsExecuteMock.mockReset();
    getTrackStepBySimulatorExecuteMock.mockReset();
    notFoundMock.mockClear();
  });

  it('excludes a simulator that is a track step, keeping a standalone one', async () => {
    listPublishedSimulatorsExecuteMock.mockResolvedValue([
      { id: 'sim-standalone', title: 'Simulacro suelto', description: null },
      { id: 'sim-track-step', title: 'Simulacro de pista', description: null },
    ]);
    getTrackStepBySimulatorExecuteMock.mockImplementation((_ctx: unknown, simulatorId: string) =>
      Promise.resolve(simulatorId === 'sim-track-step' ? { id: 'step-1' } : null),
    );
    const SimulatorCatalogPage = (
      await import('../../../src/app/dashboard/learn/simulators/page')
    ).default;

    render(await SimulatorCatalogPage());

    expect(screen.getByText('Simulacro suelto')).toBeInTheDocument();
    expect(screen.queryByText('Simulacro de pista')).not.toBeInTheDocument();
  });
});

describe('Standalone learner detail — track-step bypass fix', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    getPublishedSimulatorExecuteMock.mockReset();
    getTrackStepBySimulatorExecuteMock.mockReset();
    notFoundMock.mockClear();
  });

  const params = () => Promise.resolve({ simulatorId: 'sim-track-step' });

  it('SECURITY — calls notFound() (server-side) for a simulator that is a track step, closing the standalone start bypass', async () => {
    getPublishedSimulatorExecuteMock.mockResolvedValue({
      id: 'sim-track-step',
      title: 'Simulacro de pista',
      description: null,
      questionCount: 10,
      timeLimitMinutes: 30,
      passingScore: 70,
      attemptLimit: 3,
    });
    getTrackStepBySimulatorExecuteMock.mockResolvedValue({ id: 'step-1', trackId: 'track-1' });
    const SimulatorDetailPage = (
      await import('../../../src/app/dashboard/learn/simulators/[simulatorId]/page')
    ).default;

    await expect(SimulatorDetailPage({ params: params() })).rejects.toThrow(FakeNotFoundSignal);
  });

  it('still renders a standalone (non-track) simulator normally', async () => {
    getPublishedSimulatorExecuteMock.mockResolvedValue({
      id: 'sim-standalone',
      title: 'Simulacro suelto',
      description: null,
      questionCount: 10,
      timeLimitMinutes: 30,
      passingScore: 70,
      attemptLimit: 3,
    });
    getTrackStepBySimulatorExecuteMock.mockResolvedValue(null);
    const SimulatorDetailPage = (
      await import('../../../src/app/dashboard/learn/simulators/[simulatorId]/page')
    ).default;

    render(await SimulatorDetailPage({ params: Promise.resolve({ simulatorId: 'sim-standalone' }) }));

    expect(screen.getByText('Simulacro suelto')).toBeInTheDocument();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

/**
 * ENDPOINT-level guard tests — Phase 6 fix (HIGH ship-blocker).
 *
 * The catalog/detail exclusion above only hides the UI path to a track-step
 * simulator's standalone start button; it does NOT, by itself, prove the
 * `startAttemptAction` ENDPOINT rejects a locked step. Framework bound-arg
 * encryption and UI hiding are not an authorization boundary — any future
 * change that reaches this action directly (e.g. a raw `simulatorId` form
 * input, a client replay of a captured request) would bypass gamified
 * progression entirely if the endpoint itself trusted the caller. These
 * tests drive `startAttemptAction` DIRECTLY, independent of any page/UI
 * behavior, proving the endpoint is authoritative on its own.
 */
const studentActionCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const initialActionState = { ok: true } as const;

describe('startAttemptAction — endpoint-level guard (not just UI hiding)', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentActionCtx);
    startAttemptExecuteMock.mockReset();
    startTrackStepAttemptExecuteMock.mockReset();
    redirectMock.mockClear();
  });

  it('SECURITY — rejects starting an attempt on a LOCKED track step via the raw endpoint, with no redirect', async () => {
    // The raw, ungated use-case would happily start an attempt if it were
    // still what the action called (this is the vulnerability being
    // fixed) — mocked here to prove the action no longer reaches it.
    startAttemptExecuteMock.mockResolvedValue({ id: 'attempt-should-never-exist' });
    const locked = new Error('Simulator "sim-track-step" is locked for this learner');
    locked.name = 'StepLockedError';
    startTrackStepAttemptExecuteMock.mockRejectedValue(locked);

    const { startAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/actions'
    );

    const result = await startAttemptAction('sim-track-step', initialActionState, new FormData());

    expect(result).toEqual({
      ok: false,
      error: 'Todavía no desbloqueaste este paso. Superá el paso anterior primero.',
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(startTrackStepAttemptExecuteMock).toHaveBeenCalledWith(
      studentActionCtx,
      expect.objectContaining({ simulatorId: 'sim-track-step' }),
    );
  });

  it('still starts and redirects normally for a standalone (non-track) simulator through the re-pointed action', async () => {
    startTrackStepAttemptExecuteMock.mockResolvedValue({ id: 'attempt-standalone' });

    const { startAttemptAction } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/actions'
    );

    await expect(
      startAttemptAction('sim-standalone', initialActionState, new FormData()),
    ).rejects.toThrow(FakeRedirectSignal);

    expect(startTrackStepAttemptExecuteMock).toHaveBeenCalledWith(
      studentActionCtx,
      expect.objectContaining({ simulatorId: 'sim-standalone' }),
    );
    expect(redirectMock).toHaveBeenCalledWith(
      '/dashboard/learn/simulators/sim-standalone/attempt/attempt-standalone',
    );
  });
});
