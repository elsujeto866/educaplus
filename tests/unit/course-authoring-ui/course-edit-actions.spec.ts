/**
 * Course edit/status Server Actions unit tests: updateCourseAction,
 * publishCourseAction, unpublishCourseAction, deleteCourseAction.
 *
 * Mocks the same boundaries as create-course-action.spec.ts:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/course/composition'       → makeCourseComposition
 *  - 'next/cache'                          → revalidatePath
 *  - 'next/navigation'                     → redirect (throws, like the real one)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const updateCourseExecuteMock = vi.fn();
const publishCourseExecuteMock = vi.fn();
const unpublishCourseExecuteMock = vi.fn();
const deleteCourseExecuteMock = vi.fn();

vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    updateCourse: { execute: updateCourseExecuteMock },
    publishCourse: { execute: publishCourseExecuteMock },
    unpublishCourse: { execute: unpublishCourseExecuteMock },
    deleteCourse: { execute: deleteCourseExecuteMock },
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
const courseId = 'course-1';

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: ActionResult = { ok: true };

beforeEach(() => {
  getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
  updateCourseExecuteMock.mockReset();
  publishCourseExecuteMock.mockReset();
  unpublishCourseExecuteMock.mockReset();
  deleteCourseExecuteMock.mockReset();
  revalidatePathMock.mockClear();
  redirectMock.mockClear();
});

describe('updateCourseAction', () => {
  it('rejects an invalid title WITHOUT calling getTenantContext or the composition', async () => {
    const { updateCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateCourseAction(courseId, initialState, formDataWith({ title: 'ab' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(updateCourseExecuteMock).not.toHaveBeenCalled();
  });

  it('updates the course and revalidates the detail page WITHOUT redirecting', async () => {
    updateCourseExecuteMock.mockResolvedValue({ id: courseId });
    const { updateCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateCourseAction(
      courseId,
      initialState,
      formDataWith({ title: 'Curso actualizado', description: 'Nueva descripción' }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateCourseExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      id: courseId,
      title: 'Curso actualizado',
      description: 'Nueva descripción',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('maps a domain error thrown by the use-case to a Spanish ActionResult', async () => {
    const slugConflict = new Error('Slug "curso" is already taken');
    slugConflict.name = 'SlugConflictError';
    updateCourseExecuteMock.mockRejectedValue(slugConflict);
    const { updateCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateCourseAction(courseId, initialState, formDataWith({ title: 'Curso repetido' }));

    expect(result).toEqual({ ok: false, error: 'Ya existe un curso con ese título.' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe('publishCourseAction', () => {
  it('publishes the course and revalidates the detail page', async () => {
    publishCourseExecuteMock.mockResolvedValue({ id: courseId, status: 'published' });
    const { publishCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    await publishCourseAction(courseId, new FormData());

    expect(publishCourseExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: courseId });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });
});

describe('unpublishCourseAction', () => {
  it('unpublishes the course and revalidates the detail page', async () => {
    unpublishCourseExecuteMock.mockResolvedValue({ id: courseId, status: 'draft' });
    const { unpublishCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    await unpublishCourseAction(courseId, new FormData());

    expect(unpublishCourseExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: courseId });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });
});

describe('deleteCourseAction', () => {
  it('deletes the course, revalidates the list, and redirects to the list', async () => {
    deleteCourseExecuteMock.mockResolvedValue(undefined);
    const { deleteCourseAction } = await import('../../../src/app/dashboard/courses/actions');

    await expect(deleteCourseAction(courseId, new FormData())).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(deleteCourseExecuteMock).toHaveBeenCalledWith(instructorCtx, { id: courseId });
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/courses');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/courses');
  });
});
