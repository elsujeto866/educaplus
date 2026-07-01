/**
 * requireInstructor unit tests.
 *
 * `next/navigation`'s real `redirect()` throws a control-flow error by
 * design, so it is mocked here as a plain `vi.fn()` — we assert it WAS
 * (or was NOT) called with the expected path, matching how a Server
 * Component would observe the side effect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

function ctxWithRole(role: TenantContext['role']): TenantContext {
  return { orgId: 'org_A', userId: 'user_1', role };
}

describe('requireInstructor', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('redirects a student to /dashboard', async () => {
    const { requireInstructor } = await import('../../../src/app/dashboard/courses/_lib/require-instructor');

    requireInstructor(ctxWithRole('student'));

    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('does NOT redirect an admin', async () => {
    const { requireInstructor } = await import('../../../src/app/dashboard/courses/_lib/require-instructor');

    requireInstructor(ctxWithRole('admin'));

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('does NOT redirect an instructor', async () => {
    const { requireInstructor } = await import('../../../src/app/dashboard/courses/_lib/require-instructor');

    requireInstructor(ctxWithRole('instructor'));

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
