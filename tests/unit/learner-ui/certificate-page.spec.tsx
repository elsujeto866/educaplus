/**
 * Certificate page (`.../[courseId]/certificate/page.tsx`) tests —
 * spec.md's "Certificate View Rendering" / "Issuance on View (Idempotent)"
 * / "Pass Gate" / "Enrollment Gate" domains, PLUS the epic's TOP security
 * requirement: the certificate `id` passed to `IssueCertificateUseCase`
 * MUST be generated server-side via `crypto.randomUUID()` inside this RSC
 * — never sourced from `params`/request input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const getEnrolledCourseExecuteMock = vi.fn();
const issueCertificateExecuteMock = vi.fn();
const getAssessmentExecuteMock = vi.fn();
const getLatestPassedExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    getEnrolledCourse: { execute: getEnrolledCourseExecuteMock },
    issueCertificate: { execute: issueCertificateExecuteMock },
    getAssessment: { execute: getAssessmentExecuteMock },
    getLatestPassed: { execute: getLatestPassedExecuteMock },
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
  usePathname: () => '/dashboard/learn/courses/course-1/certificate',
}));

const SERVER_UUID = '11111111-1111-4111-8111-111111111111';
const randomUUIDMock = vi.fn(() => SERVER_UUID);

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

function enrolledView(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    course: { id: 'course-1', title: 'Intro a React' },
    modules: [],
    progressPercent: 100,
    isEnrolled: true,
    enrollmentId: 'enrollment-1',
    ...overrides,
  };
}

function certificate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SERVER_UUID,
    courseId: 'course-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    certificateCode: 'CERT-2026-11111111',
    score: 90,
    studentName: 'Ada Lovelace',
    courseTitle: 'Intro a React',
    academyName: 'Educaplus Academy',
    issuedAt: new Date('2026-03-15T12:00:00Z'),
    ...overrides,
  };
}

// A non-uuid-shaped courseId route param — proves the `id` sent to
// `issueCertificate.execute` can never have been derived from `params`.
const params = () => Promise.resolve({ courseId: 'course-1' });

describe('Certificate page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    getEnrolledCourseExecuteMock.mockReset();
    issueCertificateExecuteMock.mockReset();
    getAssessmentExecuteMock.mockReset().mockResolvedValue(null);
    getLatestPassedExecuteMock.mockReset().mockResolvedValue({ score: 90, passed: true });
    getAcademyExecuteMock.mockReset().mockResolvedValue({ id: 'org_A', name: 'Educaplus Academy' });
    currentUserMock.mockReset().mockResolvedValue({ fullName: 'Ada Lovelace', username: 'ada' });
    getOrganizationMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
    randomUUIDMock.mockClear();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(randomUUIDMock as never);
  });

  it('calls notFound() when the course does not exist', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(null);
    const CertificatePage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/certificate/page')
    ).default;

    await expect(CertificatePage({ params: params() })).rejects.toThrow(FakeNotFoundSignal);
    expect(issueCertificateExecuteMock).not.toHaveBeenCalled();
  });

  it('redirects to the course page when the caller is not enrolled', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(
      enrolledView({ isEnrolled: false, enrollmentId: null }),
    );
    const CertificatePage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/certificate/page')
    ).default;

    await expect(CertificatePage({ params: params() })).rejects.toThrow(FakeRedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/learn/courses/course-1');
    expect(issueCertificateExecuteMock).not.toHaveBeenCalled();
  });

  it('redirects to the quiz page when CertificateNotEarnedError is thrown', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    class CertificateNotEarnedError extends Error {
      constructor() {
        super('not earned');
        this.name = 'CertificateNotEarnedError';
      }
    }
    issueCertificateExecuteMock.mockRejectedValue(new CertificateNotEarnedError());
    const CertificatePage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/certificate/page')
    ).default;

    await expect(CertificatePage({ params: params() })).rejects.toThrow(FakeRedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/learn/courses/course-1/quiz');
  });

  it('renders the certificate view on success', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    issueCertificateExecuteMock.mockResolvedValue(certificate());
    const CertificatePage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/certificate/page')
    ).default;

    render(await CertificatePage({ params: params() }));

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getAllByText('Intro a React').length).toBeGreaterThan(0);
    expect(screen.getByText('Educaplus Academy')).toBeInTheDocument();
    expect(screen.getByText('CERT-2026-11111111')).toBeInTheDocument();
  });

  it('SECURITY: passes a server-generated (crypto.randomUUID) id to issueCertificate.execute, never derived from params/input', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    issueCertificateExecuteMock.mockResolvedValue(certificate());
    const CertificatePage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/certificate/page')
    ).default;

    await CertificatePage({ params: params() });

    expect(randomUUIDMock).toHaveBeenCalledOnce();
    expect(issueCertificateExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ id: SERVER_UUID }),
    );
    const [, input] = issueCertificateExecuteMock.mock.calls[0] as [TenantContext, { id: string }];
    // Never equal to the route param or any other request-derived string.
    expect(input.id).not.toBe('course-1');
    expect(input.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('falls back to the Clerk organization name when the academy is not provisioned yet', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    getAcademyExecuteMock.mockResolvedValue(null);
    getOrganizationMock.mockResolvedValue({ name: 'Clerk Org Name' });
    issueCertificateExecuteMock.mockResolvedValue(certificate({ academyName: 'Clerk Org Name' }));
    const CertificatePage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/certificate/page')
    ).default;

    render(await CertificatePage({ params: params() }));

    expect(issueCertificateExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ academyName: 'Clerk Org Name' }),
    );
  });

  it('falls back to "Estudiante" when Clerk has no name/username', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    currentUserMock.mockResolvedValue({ fullName: null, username: null });
    issueCertificateExecuteMock.mockResolvedValue(certificate({ studentName: 'Estudiante' }));
    const CertificatePage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/certificate/page')
    ).default;

    await CertificatePage({ params: params() });

    expect(issueCertificateExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ studentName: 'Estudiante' }),
    );
  });
});
