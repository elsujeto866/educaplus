/**
 * markLessonCompleteAction unit tests — same canonical Server Action shape
 * as course-authoring's `updateCourseAction` (returns ActionResult, no
 * redirect on success).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const markLessonCompleteExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    markLessonComplete: { execute: markLessonCompleteExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

const initialState: ActionResult = { ok: true };

describe('markLessonCompleteAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    markLessonCompleteExecuteMock.mockReset();
    revalidatePathMock.mockClear();
  });

  it('marks the lesson complete and revalidates the lesson and course paths', async () => {
    markLessonCompleteExecuteMock.mockResolvedValue(undefined);
    const { markLessonCompleteAction } = await import('../../../src/app/dashboard/learn/actions');

    const result = await markLessonCompleteAction(
      'course-1',
      'lesson-1',
      'enrollment-1',
      initialState,
      new FormData(),
    );

    expect(result).toEqual({ ok: true });
    expect(markLessonCompleteExecuteMock).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({
        enrollmentId: 'enrollment-1',
        lessonId: 'lesson-1',
        academyId: studentCtx.orgId,
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/dashboard/learn/courses/course-1/lessons/lesson-1',
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/learn/courses/course-1');
  });

  it('maps an unexpected error to a generic Spanish message', async () => {
    markLessonCompleteExecuteMock.mockRejectedValue(new Error('boom'));
    const { markLessonCompleteAction } = await import('../../../src/app/dashboard/learn/actions');

    const result = await markLessonCompleteAction(
      'course-1',
      'lesson-1',
      'enrollment-1',
      initialState,
      new FormData(),
    );

    expect(result).toEqual({ ok: false, error: 'Ocurrió un error. Intentá de nuevo.' });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
