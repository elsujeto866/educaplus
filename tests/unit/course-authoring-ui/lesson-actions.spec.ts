/**
 * Lesson editor Server Actions unit tests: addLessonAction,
 * updateLessonBodyAction, updateLessonVideoUrlAction, reorderLessonUpAction,
 * reorderLessonDownAction.
 *
 * Mocks the same boundaries as module-actions.spec.ts / create-course-action.spec.ts:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/course/composition'       → makeCourseComposition
 *  - 'next/cache'                          → revalidatePath
 *  - 'next/navigation'                     → redirect (addLessonAction only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const addLessonExecuteMock = vi.fn();
const updateLessonBodyExecuteMock = vi.fn();
const getLessonExecuteMock = vi.fn();
const getCourseDetailExecuteMock = vi.fn();
const reorderLessonsExecuteMock = vi.fn();

vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    addLesson: { execute: addLessonExecuteMock },
    updateLessonBody: { execute: updateLessonBodyExecuteMock },
    getLesson: { execute: getLessonExecuteMock },
    getCourseDetail: { execute: getCourseDetailExecuteMock },
    reorderLessons: { execute: reorderLessonsExecuteMock },
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
const moduleId = 'module-1';
const lessonId = 'lesson-1';

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const initialState: ActionResult = { ok: true };

beforeEach(() => {
  getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
  addLessonExecuteMock.mockReset();
  updateLessonBodyExecuteMock.mockReset();
  getLessonExecuteMock.mockReset();
  getCourseDetailExecuteMock.mockReset();
  reorderLessonsExecuteMock.mockReset();
  revalidatePathMock.mockClear();
  redirectMock.mockClear();
});

describe('addLessonAction', () => {
  it('rejects an invalid title WITHOUT calling getTenantContext or the composition', async () => {
    const { addLessonAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await addLessonAction(
      courseId,
      moduleId,
      initialState,
      formDataWith({ title: 'ab', type: 'text' }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(addLessonExecuteMock).not.toHaveBeenCalled();
  });

  it('rejects a video lesson submitted without an external URL', async () => {
    const { addLessonAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await addLessonAction(
      courseId,
      moduleId,
      initialState,
      formDataWith({ title: 'Lección de video', type: 'video' }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(addLessonExecuteMock).not.toHaveBeenCalled();
  });

  it('adds a text lesson with an empty markdown envelope, revalidates, and redirects to the editor', async () => {
    addLessonExecuteMock.mockResolvedValue({ id: 'lesson-new' });
    const { addLessonAction } = await import('../../../src/app/dashboard/courses/actions');

    await expect(
      addLessonAction(courseId, moduleId, initialState, formDataWith({ title: 'Introducción', type: 'text' })),
    ).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(addLessonExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        moduleId,
        academyId: instructorCtx.orgId,
        type: 'text',
        title: 'Introducción',
        content: { type: 'text', body: { format: 'markdown', value: '' } },
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
    expect(redirectMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}/lessons/lesson-new`);
  });

  it('adds a video lesson with the given external URL', async () => {
    addLessonExecuteMock.mockResolvedValue({ id: 'lesson-new' });
    const { addLessonAction } = await import('../../../src/app/dashboard/courses/actions');

    await expect(
      addLessonAction(
        courseId,
        moduleId,
        initialState,
        formDataWith({ title: 'Video 1', type: 'video', externalUrl: 'https://youtube.com/watch?v=abc' }),
      ),
    ).rejects.toBeInstanceOf(FakeRedirectSignal);

    expect(addLessonExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        type: 'video',
        content: {
          type: 'video',
          cloudflareUid: null,
          durationSeconds: null,
          thumbnailUrl: null,
          externalUrl: 'https://youtube.com/watch?v=abc',
        },
      }),
    );
  });

  it('maps a domain error thrown by the use-case to a Spanish ActionResult and does NOT redirect', async () => {
    const err = new Error('boom');
    err.name = 'InvalidReorderError';
    addLessonExecuteMock.mockRejectedValue(err);
    const { addLessonAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await addLessonAction(
      courseId,
      moduleId,
      initialState,
      formDataWith({ title: 'Introducción', type: 'text' }),
    );

    expect(result).toEqual({ ok: false, error: 'No se pudo reordenar.' });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('updateLessonBodyAction', () => {
  it('saves the markdown envelope and revalidates the lesson editor page', async () => {
    updateLessonBodyExecuteMock.mockResolvedValue({ id: lessonId });
    const { updateLessonBodyAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateLessonBodyAction(
      courseId,
      lessonId,
      initialState,
      formDataWith({ body: '# Hola' }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateLessonBodyExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      lessonId,
      content: { type: 'text', body: { format: 'markdown', value: '# Hola' } },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
  });

  it('maps a domain error to a Spanish ActionResult', async () => {
    const err = new Error('not found');
    updateLessonBodyExecuteMock.mockRejectedValue(err);
    const { updateLessonBodyAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateLessonBodyAction(courseId, lessonId, initialState, formDataWith({ body: 'x' }));

    expect(result).toEqual({ ok: false, error: 'Ocurrió un error. Intentá de nuevo.' });
  });
});

describe('updateLessonVideoUrlAction', () => {
  it('rejects a malformed URL WITHOUT calling getTenantContext or the composition', async () => {
    const { updateLessonVideoUrlAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateLessonVideoUrlAction(
      courseId,
      lessonId,
      initialState,
      formDataWith({ externalUrl: 'no-es-una-url' }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(updateLessonBodyExecuteMock).not.toHaveBeenCalled();
  });

  it('merges the new URL into the existing video content and revalidates', async () => {
    getLessonExecuteMock.mockResolvedValue({
      id: lessonId,
      type: 'video',
      content: {
        type: 'video',
        cloudflareUid: 'cf-123',
        durationSeconds: 90,
        thumbnailUrl: 'https://thumb',
        externalUrl: null,
      },
    });
    updateLessonBodyExecuteMock.mockResolvedValue({ id: lessonId });
    const { updateLessonVideoUrlAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateLessonVideoUrlAction(
      courseId,
      lessonId,
      initialState,
      formDataWith({ externalUrl: 'https://youtube.com/watch?v=xyz' }),
    );

    expect(result).toEqual({ ok: true });
    expect(updateLessonBodyExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      lessonId,
      content: {
        type: 'video',
        cloudflareUid: 'cf-123',
        durationSeconds: 90,
        thumbnailUrl: 'https://thumb',
        externalUrl: 'https://youtube.com/watch?v=xyz',
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
  });

  it('returns a Spanish error when the lesson is not a video lesson', async () => {
    getLessonExecuteMock.mockResolvedValue({ id: lessonId, type: 'text', content: { type: 'text', body: {} } });
    const { updateLessonVideoUrlAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await updateLessonVideoUrlAction(
      courseId,
      lessonId,
      initialState,
      formDataWith({ externalUrl: 'https://youtube.com/watch?v=xyz' }),
    );

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(updateLessonBodyExecuteMock).not.toHaveBeenCalled();
  });
});

describe('reorderLessonUpAction / reorderLessonDownAction', () => {
  it('loads the ordered lesson ids for the module, swaps the target up, and calls reorderLessons', async () => {
    getCourseDetailExecuteMock.mockResolvedValue({
      course: { id: courseId },
      modules: [{ id: moduleId, lessons: [{ id: 'l-1' }, { id: 'l-2' }, { id: 'l-3' }] }],
    });
    const { reorderLessonUpAction } = await import('../../../src/app/dashboard/courses/actions');

    await reorderLessonUpAction(courseId, moduleId, 'l-2', new FormData());

    expect(reorderLessonsExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      moduleId,
      orderedIds: ['l-2', 'l-1', 'l-3'],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });

  it('does NOT call reorderLessons when the target is already last (no-op on down)', async () => {
    getCourseDetailExecuteMock.mockResolvedValue({
      course: { id: courseId },
      modules: [{ id: moduleId, lessons: [{ id: 'l-1' }, { id: 'l-2' }] }],
    });
    const { reorderLessonDownAction } = await import('../../../src/app/dashboard/courses/actions');

    await reorderLessonDownAction(courseId, moduleId, 'l-2', new FormData());

    expect(reorderLessonsExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });
});
