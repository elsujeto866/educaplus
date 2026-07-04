/**
 * requireInstructor unit tests — simulators section.
 *
 * Mirrors `tests/unit/course-authoring-ui/require-instructor.spec.ts`.
 * `next/navigation`'s real `redirect()` throws a control-flow error by
 * design, so it is mocked here as a plain `vi.fn()`.
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

describe('requireInstructor (simulators)', () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it('redirects a student to /dashboard', async () => {
    const { requireInstructor } = await import('../../../src/app/dashboard/simulators/_lib/require-instructor');

    requireInstructor(ctxWithRole('student'));

    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('does NOT redirect an admin', async () => {
    const { requireInstructor } = await import('../../../src/app/dashboard/simulators/_lib/require-instructor');

    requireInstructor(ctxWithRole('admin'));

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('does NOT redirect an instructor', async () => {
    const { requireInstructor } = await import('../../../src/app/dashboard/simulators/_lib/require-instructor');

    requireInstructor(ctxWithRole('instructor'));

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
