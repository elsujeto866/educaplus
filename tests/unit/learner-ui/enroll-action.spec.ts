/**
 * enrollAction unit tests — mirrors createCourseAction's canonical pattern
 * (tests/unit/course-authoring-ui/create-course-action.spec.ts).
 *
 * Mocks every boundary the action crosses:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/course/composition'       → makeCourseComposition
 *  - 'next/cache'                          → revalidatePath
 *  - 'next/navigation'                     → redirect (throws by design;
 *    the mock also throws so the test proves the action does NOT swallow
 *    it in a try/catch)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const enrollLearnerExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    enrollLearner: { execute: enrollLearnerExecuteMock },
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

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

const initialState: ActionResult = { ok: true };

describe('enrollAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    enrollLearnerExecuteMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
  });

  it('enrolls the caller, revalidates the catalog, and redirects to the course viewer', async () => {
    enrollLearnerExecuteMock.mockResolvedValue({ id: 'enrollment-1' });
    const { enrollAction } = await import('../../../src/app/dashboard/learn/actions');

    await expect(enrollAction('course-1', initialState, new FormData())).rejects.toBeInstanceOf(
      FakeRedirectSignal,
    );

    expect(enrollLearnerExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({
        courseId: 'course-1',
        academyId: studentCtx.orgId,
        clerkUserId: studentCtx.userId,
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/learn/courses');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/learn/courses/course-1');
  });

  it('maps a duplicate enrollment to the Spanish message and does NOT redirect', async () => {
    const duplicate = new Error('Enrollment already exists');
    duplicate.name = 'DuplicateEnrollmentError';
    enrollLearnerExecuteMock.mockRejectedValue(duplicate);
    const { enrollAction } = await import('../../../src/app/dashboard/learn/actions');

    const result = await enrollAction('course-1', initialState, new FormData());

    expect(result).toEqual({ ok: false, error: 'Ya estás inscripto en este curso.' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('maps a draft-course rejection to the Spanish message and does NOT redirect', async () => {
    const notPublished = new Error('Course is not published');
    notPublished.name = 'CourseNotPublishedError';
    enrollLearnerExecuteMock.mockRejectedValue(notPublished);
    const { enrollAction } = await import('../../../src/app/dashboard/learn/actions');

    const result = await enrollAction('course-1', initialState, new FormData());

    expect(result).toEqual({ ok: false, error: 'El curso debe estar publicado para esta acción.' });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
