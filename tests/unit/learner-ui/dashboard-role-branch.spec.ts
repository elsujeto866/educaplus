/**
 * DashboardPage role-branch tests — proves the regression-critical
 * contract from spec.md's "Dashboard Role Branch" domain: students render
 * `LearnerHome`, instructor/admin render `InstructorDashboard` (the
 * byte-identical extraction of the pre-existing academy-info body).
 *
 * `InstructorDashboard` and `LearnerHome` are mocked as opaque markers —
 * this test only proves the BRANCH, not either component's internals
 * (those are covered by their own specs / the pre-existing academy
 * provisioning behavior, which is untouched by this extraction).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const LearnerHomeMock = vi.fn(() => null);
vi.mock('../../../src/app/dashboard/_components/learner-home', () => ({
  LearnerHome: LearnerHomeMock,
}));

const InstructorDashboardMock = vi.fn(() => null);
vi.mock('../../../src/app/dashboard/_components/instructor-dashboard', () => ({
  InstructorDashboard: InstructorDashboardMock,
}));

function ctxWithRole(role: TenantContext['role']): TenantContext {
  return { orgId: 'org_A', userId: 'user_1', role };
}

describe('DashboardPage role branch', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset();
    LearnerHomeMock.mockClear();
    InstructorDashboardMock.mockClear();
  });

  it('renders LearnerHome (not InstructorDashboard) for a student', async () => {
    const ctx = ctxWithRole('student');
    getTenantContextMock.mockResolvedValue(ctx);
    const DashboardPage = (await import('../../../src/app/dashboard/page')).default;

    const element = (await DashboardPage()) as ReactElement<{ ctx: TenantContext }>;

    expect(element.type).toBe(LearnerHomeMock);
    expect(element.props.ctx).toEqual(ctx);
    expect(InstructorDashboardMock).not.toHaveBeenCalled();
  });

  it('renders InstructorDashboard (not LearnerHome) for an instructor', async () => {
    const ctx = ctxWithRole('instructor');
    getTenantContextMock.mockResolvedValue(ctx);
    const DashboardPage = (await import('../../../src/app/dashboard/page')).default;

    const element = (await DashboardPage()) as ReactElement<{ ctx: TenantContext }>;

    expect(element.type).toBe(InstructorDashboardMock);
    expect(element.props.ctx).toEqual(ctx);
    expect(LearnerHomeMock).not.toHaveBeenCalled();
  });

  it('renders InstructorDashboard (not LearnerHome) for an admin', async () => {
    const ctx = ctxWithRole('admin');
    getTenantContextMock.mockResolvedValue(ctx);
    const DashboardPage = (await import('../../../src/app/dashboard/page')).default;

    const element = (await DashboardPage()) as ReactElement<{ ctx: TenantContext }>;

    expect(element.type).toBe(InstructorDashboardMock);
    expect(element.props.ctx).toEqual(ctx);
    expect(LearnerHomeMock).not.toHaveBeenCalled();
  });
});
