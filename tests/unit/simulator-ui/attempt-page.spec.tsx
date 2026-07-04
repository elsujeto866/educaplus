/**
 * Attempt page (`.../attempt/[attemptId]/page.tsx`) tests — Slice S6
 * addition: the "Ver certificado" link visibility must respect the bound
 * simulator's `issuesCertificate` toggle, not just `passed`. Mirrors
 * `certificate-page.spec.tsx`'s composition-mocking strategy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const getAttemptExecuteMock = vi.fn();
const getSimulatorExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    getAttempt: { execute: getAttemptExecuteMock },
    getSimulator: { execute: getSimulatorExecuteMock },
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

function finishedAttempt(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'attempt-1',
    simulatorId: 'sim-1',
    status: 'submitted',
    frozenQuestions: [
      { id: 'q-1', prompt: '2+2', options: [{ id: 'a', label: '3' }, { id: 'b', label: '4' }], correctOptionId: 'b' },
    ],
    deadlineAt: new Date(Date.now() + 60_000),
    score: 90,
    passed: true,
    ...overrides,
  };
}

const params = () => Promise.resolve({ simulatorId: 'sim-1', attemptId: 'attempt-1' });

describe('Attempt page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    getAttemptExecuteMock.mockReset();
    getSimulatorExecuteMock.mockReset();
    notFoundMock.mockClear();
  });

  it('calls notFound() when the attempt does not exist or belongs to another simulator', async () => {
    getAttemptExecuteMock.mockResolvedValue(null);
    const AttemptPage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/page'
      )
    ).default;

    await expect(AttemptPage({ params: params() })).rejects.toThrow(FakeNotFoundSignal);
  });

  it('shows the "Ver certificado" link when the simulator issues certificates (Slice S6)', async () => {
    getAttemptExecuteMock.mockResolvedValue(finishedAttempt());
    getSimulatorExecuteMock.mockResolvedValue({ id: 'sim-1', issuesCertificate: true });
    const AttemptPage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/page'
      )
    ).default;

    render(await AttemptPage({ params: params() }));

    expect(screen.getByRole('link', { name: /ver certificado/i })).toBeInTheDocument();
  });

  it('hides the "Ver certificado" link when the simulator does NOT issue certificates (Slice S6)', async () => {
    getAttemptExecuteMock.mockResolvedValue(finishedAttempt());
    getSimulatorExecuteMock.mockResolvedValue({ id: 'sim-1', issuesCertificate: false });
    const AttemptPage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/page'
      )
    ).default;

    render(await AttemptPage({ params: params() }));

    expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
  });

  it('hides the "Ver certificado" link when the simulator lookup returns null (defensive default)', async () => {
    getAttemptExecuteMock.mockResolvedValue(finishedAttempt());
    getSimulatorExecuteMock.mockResolvedValue(null);
    const AttemptPage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/page'
      )
    ).default;

    render(await AttemptPage({ params: params() }));

    expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
  });
});
