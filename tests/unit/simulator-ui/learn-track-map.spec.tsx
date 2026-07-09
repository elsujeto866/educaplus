/**
 * Learner track level-map page (`.../learn/simulators/tracks/[trackId]/page.tsx`)
 * tests — Phase 6. Mirrors `certificate-page.spec.tsx`'s composition-mocking
 * strategy for RSC pages.
 *
 * Covers spec.md "Mixed status rendering": locked/unlocked/passed steps
 * render distinctly, only the unlocked step gets a "start" action, and a
 * draft (unpublished) track 404s exactly like a draft standalone simulator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const getTrackForLearnerExecuteMock = vi.fn();
const listPublishedSimulatorsExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    getTrackForLearner: { execute: getTrackForLearnerExecuteMock },
    listPublishedSimulators: { execute: listPublishedSimulatorsExecuteMock },
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

const SERVER_UUID = '11111111-1111-4111-8111-111111111111';
const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

function track(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'track-1',
    title: 'Ruta de matemática',
    description: 'Superá cada simulacro para avanzar.',
    status: 'published',
    ...overrides,
  };
}

function simulators() {
  return [
    { id: 'sim-1', title: 'Álgebra básica', description: 'Nivel 1', status: 'published' },
    { id: 'sim-2', title: 'Álgebra intermedia', description: 'Nivel 2', status: 'published' },
    { id: 'sim-3', title: 'Álgebra avanzada', description: 'Nivel 3', status: 'published' },
  ];
}

const params = () => Promise.resolve({ trackId: 'track-1' });

describe('Learner track level-map page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    getTrackForLearnerExecuteMock.mockReset();
    listPublishedSimulatorsExecuteMock.mockReset().mockResolvedValue(simulators());
    notFoundMock.mockClear();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(SERVER_UUID as never);
  });

  it('calls notFound() when the track does not exist (or belongs to another tenant)', async () => {
    const notFoundError = new Error('not found');
    notFoundError.name = 'SimulatorTrackNotFoundError';
    getTrackForLearnerExecuteMock.mockRejectedValue(notFoundError);
    const LearnerTrackMapPage = (
      await import('../../../src/app/dashboard/learn/simulators/tracks/[trackId]/page')
    ).default;

    await expect(LearnerTrackMapPage({ params: params() })).rejects.toThrow(FakeNotFoundSignal);
  });

  it('calls notFound() when the track is still a draft (not yet published)', async () => {
    getTrackForLearnerExecuteMock.mockResolvedValue({
      track: track({ status: 'draft' }),
      steps: [{ stepId: 'step-1', simulatorId: 'sim-1', position: 1, status: 'unlocked' }],
    });
    const LearnerTrackMapPage = (
      await import('../../../src/app/dashboard/learn/simulators/tracks/[trackId]/page')
    ).default;

    await expect(LearnerTrackMapPage({ params: params() })).rejects.toThrow(FakeNotFoundSignal);
  });

  it('MIXED STATUS RENDERING (spec.md): passed, unlocked, locked steps render distinct gamified states', async () => {
    getTrackForLearnerExecuteMock.mockResolvedValue({
      track: track(),
      steps: [
        { stepId: 'step-1', simulatorId: 'sim-1', position: 1, status: 'passed' },
        { stepId: 'step-2', simulatorId: 'sim-2', position: 2, status: 'unlocked' },
        { stepId: 'step-3', simulatorId: 'sim-3', position: 3, status: 'locked' },
      ],
    });
    const LearnerTrackMapPage = (
      await import('../../../src/app/dashboard/learn/simulators/tracks/[trackId]/page')
    ).default;

    render(await LearnerTrackMapPage({ params: params() }));

    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
  });

  it('renders a start action ONLY for the unlocked step (not for locked or passed steps)', async () => {
    getTrackForLearnerExecuteMock.mockResolvedValue({
      track: track(),
      steps: [
        { stepId: 'step-1', simulatorId: 'sim-1', position: 1, status: 'passed' },
        { stepId: 'step-2', simulatorId: 'sim-2', position: 2, status: 'unlocked' },
        { stepId: 'step-3', simulatorId: 'sim-3', position: 3, status: 'locked' },
      ],
    });
    const LearnerTrackMapPage = (
      await import('../../../src/app/dashboard/learn/simulators/tracks/[trackId]/page')
    ).default;

    render(await LearnerTrackMapPage({ params: params() }));

    expect(screen.getAllByRole('button', { name: /comenzar/i })).toHaveLength(1);
  });
});
