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
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    listPublishedSimulators: { execute: listPublishedSimulatorsExecuteMock },
    getPublishedSimulator: { execute: getPublishedSimulatorExecuteMock },
    getTrackStepBySimulator: { execute: getTrackStepBySimulatorExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

class FakeNotFoundSignal extends Error {}
const notFoundMock = vi.fn(() => {
  throw new FakeNotFoundSignal('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
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
