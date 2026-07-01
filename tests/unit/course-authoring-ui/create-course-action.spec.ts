/**
 * createCourseAction unit tests — the canonical Server Action pattern.
 *
 * Mocks every boundary the action crosses:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/course/composition'       → makeCourseComposition
 *  - 'next/cache'                          → revalidatePath
 *  - 'next/navigation'                     → redirect (real Next redirect()
 *    throws by design; the mock also throws so the test proves the action
 *    does NOT swallow it in a try/catch, matching the canonical pattern).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const createCourseExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    createCourse: { execute: createCourseExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

class FakeRedirectSignal extends Error {}
const redirectMock = vi.fn((_path: string) => {
  throw new FakeRedirectSignal('NEXT_REDIRECT');
});
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'instructor' };

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: ActionResult = { ok: true };

describe('createCourseAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    createCourseExecuteMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it('rejects an invalid title WITHOUT calling getTenantContext or the composition', async () => {
    const { createCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await createCourseAction(initialState, formDataWith({ title: 'ab' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect((result as { ok: false; error: string }).error).toMatch(/título/i);
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(createCourseExecuteMock).not.toHaveBeenCalled();
  });

  it('creates the course, revalidates the list, and redirects on success', async () => {
    createCourseExecuteMock.mockResolvedValue({ id: 'course-new' });
    const { createCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    await expect(
      createCourseAction(initialState, formDataWith({ title: 'Mi curso nuevo', description: 'Una descripción' })),
    ).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(createCourseExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        academyId: instructorCtx.orgId,
        title: 'Mi curso nuevo',
        description: 'Una descripción',
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/courses');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/courses');
  });

  it('maps a domain error thrown by the use-case to a Spanish ActionResult and does NOT redirect', async () => {
    const slugConflict = new Error('Slug "mi-curso" is already taken');
    slugConflict.name = 'SlugConflictError';
    createCourseExecuteMock.mockRejectedValue(slugConflict);
    const { createCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await createCourseAction(initialState, formDataWith({ title: 'Mi curso' }));

    expect(result).toEqual({ ok: false, error: 'Ya existe un curso con ese título.' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
