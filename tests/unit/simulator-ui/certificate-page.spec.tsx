/**
 * Simulator certificate page (`.../[simulatorId]/certificate/page.tsx`)
 * tests — mirrors `tests/unit/learner-ui/certificate-page.spec.tsx`
 * (course), adapted: no enrollment gate (simulators are standalone, no
 * course enrollment required), simulator lookup is NOT gated on the
 * publish toggle (a certificate proves a HISTORICAL pass — hiding it just
 * because the simulator was later unpublished would be a regression), plus
 * the epic's TOP security requirement carried over from course: the
 * certificate `id` passed to `IssueSimulatorCertificateUseCase` MUST be
 * generated server-side via `crypto.randomUUID()` inside this RSC — never
 * sourced from `params`/request input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const getSimulatorExecuteMock = vi.fn();
const issueSimulatorCertificateExecuteMock = vi.fn();
vi.mock('../../../src/modules/simulator/composition', () => ({
  makeSimulatorComposition: () => ({
    getSimulator: { execute: getSimulatorExecuteMock },
    issueSimulatorCertificate: { execute: issueSimulatorCertificateExecuteMock },
  }),
}));

const getAcademyExecuteMock = vi.fn();
vi.mock('../../../src/modules/academy/composition', () => ({
  makeAcademyComposition: () => ({
    getAcademy: { execute: getAcademyExecuteMock },
  }),
}));

const currentUserMock = vi.fn();
const getOrganizationMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  currentUser: () => currentUserMock(),
  clerkClient: async () => ({
    organizations: { getOrganization: (args: unknown) => getOrganizationMock(args) },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

class FakeRedirectSignal extends Error {}
const redirectMock = vi.fn((_path: string) => {
  throw new FakeRedirectSignal('NEXT_REDIRECT');
});
class FakeNotFoundSignal extends Error {}
const notFoundMock = vi.fn(() => {
  throw new FakeNotFoundSignal('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  notFound: () => notFoundMock(),
  usePathname: () => '/dashboard/learn/simulators/sim-1/certificate',
}));

const SERVER_UUID = '11111111-1111-4111-8111-111111111111';
const randomUUIDMock = vi.fn(() => SERVER_UUID);

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

function simulator(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sim-1',
    title: 'Simulacro de Álgebra',
    status: 'published',
    issuesCertificate: true,
    ...overrides,
  };
}

function certificate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SERVER_UUID,
    simulatorId: 'sim-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    certificateCode: 'CERT-2026-11111111',
    score: 90,
    studentName: 'Ada Lovelace',
    simulatorTitle: 'Simulacro de Álgebra',
    academyName: 'Educaplus Academy',
    issuedAt: new Date('2026-03-15T12:00:00Z'),
    ...overrides,
  };
}

// A non-uuid-shaped simulatorId route param — proves the `id` sent to
// `issueSimulatorCertificate.execute` can never have been derived from `params`.
const params = () => Promise.resolve({ simulatorId: 'sim-1' });

describe('Simulator certificate page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    getSimulatorExecuteMock.mockReset();
    issueSimulatorCertificateExecuteMock.mockReset();
    getAcademyExecuteMock.mockReset().mockResolvedValue({ id: 'org_A', name: 'Educaplus Academy' });
    currentUserMock.mockReset().mockResolvedValue({ fullName: 'Ada Lovelace', username: 'ada' });
    getOrganizationMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
    randomUUIDMock.mockClear();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(randomUUIDMock as never);
  });

  it('calls notFound() when the simulator does not exist (or belongs to another tenant)', async () => {
    getSimulatorExecuteMock.mockResolvedValue(null);
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    await expect(CertificatePage({ params: params() })).rejects.toThrow(FakeNotFoundSignal);
    expect(issueSimulatorCertificateExecuteMock).not.toHaveBeenCalled();
  });

  it('redirects to the simulator detail page when SimulatorCertificateNotEarnedError is thrown', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator());
    class SimulatorCertificateNotEarnedError extends Error {
      constructor() {
        super('not earned');
        this.name = 'SimulatorCertificateNotEarnedError';
      }
    }
    issueSimulatorCertificateExecuteMock.mockRejectedValue(new SimulatorCertificateNotEarnedError());
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    await expect(CertificatePage({ params: params() })).rejects.toThrow(FakeRedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/learn/simulators/sim-1');
  });

  it('redirects to the simulator detail page when SimulatorCertificateNotConfiguredError is thrown (Slice S6 toggle off)', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator());
    class SimulatorCertificateNotConfiguredError extends Error {
      constructor() {
        super('not configured');
        this.name = 'SimulatorCertificateNotConfiguredError';
      }
    }
    issueSimulatorCertificateExecuteMock.mockRejectedValue(new SimulatorCertificateNotConfiguredError());
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    await expect(CertificatePage({ params: params() })).rejects.toThrow(FakeRedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/learn/simulators/sim-1');
  });

  it('passes the simulator\'s issuesCertificate flag through to issueSimulatorCertificate.execute (Slice S6)', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator({ issuesCertificate: false }));
    issueSimulatorCertificateExecuteMock.mockResolvedValue(certificate());
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    await CertificatePage({ params: params() }).catch(() => undefined);

    expect(issueSimulatorCertificateExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ issuesCertificate: false }),
    );
  });

  it('renders the certificate view on success', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator());
    issueSimulatorCertificateExecuteMock.mockResolvedValue(certificate());
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    render(await CertificatePage({ params: params() }));

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getAllByText('Simulacro de Álgebra').length).toBeGreaterThan(0);
    expect(screen.getByText('Educaplus Academy')).toBeInTheDocument();
    expect(screen.getByText('CERT-2026-11111111')).toBeInTheDocument();
  });

  it('SECURITY: passes a server-generated (crypto.randomUUID) id to issueSimulatorCertificate.execute, never derived from params/input', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator());
    issueSimulatorCertificateExecuteMock.mockResolvedValue(certificate());
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    await CertificatePage({ params: params() });

    expect(randomUUIDMock).toHaveBeenCalledOnce();
    expect(issueSimulatorCertificateExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ id: SERVER_UUID, simulatorId: 'sim-1' }),
    );
    const [, input] = issueSimulatorCertificateExecuteMock.mock.calls[0] as [
      TenantContext,
      { id: string },
    ];
    expect(input.id).not.toBe('sim-1');
    expect(input.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('does NOT gate on the simulator being currently published — a since-unpublished simulator still shows an already-earned certificate', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator({ status: 'draft' }));
    issueSimulatorCertificateExecuteMock.mockResolvedValue(certificate());
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    render(await CertificatePage({ params: params() }));

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByText('CERT-2026-11111111')).toBeInTheDocument();
  });

  it('falls back to the Clerk organization name when the academy is not provisioned yet', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator());
    getAcademyExecuteMock.mockResolvedValue(null);
    getOrganizationMock.mockResolvedValue({ name: 'Clerk Org Name' });
    issueSimulatorCertificateExecuteMock.mockResolvedValue(
      certificate({ academyName: 'Clerk Org Name' }),
    );
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    render(await CertificatePage({ params: params() }));

    expect(issueSimulatorCertificateExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ academyName: 'Clerk Org Name' }),
    );
  });

  it('falls back to "Estudiante" when Clerk has no name/username', async () => {
    getSimulatorExecuteMock.mockResolvedValue(simulator());
    currentUserMock.mockResolvedValue({ fullName: null, username: null });
    issueSimulatorCertificateExecuteMock.mockResolvedValue(certificate({ studentName: 'Estudiante' }));
    const CertificatePage = (
      await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/certificate/page'
      )
    ).default;

    await CertificatePage({ params: params() });

    expect(issueSimulatorCertificateExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ studentName: 'Estudiante' }),
    );
  });
});
