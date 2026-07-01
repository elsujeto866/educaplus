/**
 * Module management Server Actions unit tests: addModuleAction,
 * reorderModuleUpAction, reorderModuleDownAction.
 *
 * Mocks the same boundaries as create-course-action.spec.ts:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/course/composition'       → makeCourseComposition
 *  - 'next/cache'                          → revalidatePath
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const addModuleExecuteMock = vi.fn();
const getCourseDetailExecuteMock = vi.fn();
const reorderModulesExecuteMock = vi.fn();

vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    addModule: { execute: addModuleExecuteMock },
    getCourseDetail: { execute: getCourseDetailExecuteMock },
    reorderModules: { execute: reorderModulesExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
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
  addModuleExecuteMock.mockReset();
  getCourseDetailExecuteMock.mockReset();
  reorderModulesExecuteMock.mockReset();
  revalidatePathMock.mockClear();
});

describe('addModuleAction', () => {
  it('rejects an invalid title WITHOUT calling getTenantContext or the composition', async () => {
    const { addModuleAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await addModuleAction(courseId, initialState, formDataWith({ title: 'ab' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(getTenantContextMock).not.toHaveBeenCalled();
    expect(addModuleExecuteMock).not.toHaveBeenCalled();
  });

  it('adds the module and revalidates the detail page', async () => {
    addModuleExecuteMock.mockResolvedValue({ id: 'module-1' });
    const { addModuleAction } = await import('../../../src/app/dashboard/courses/actions');

    const result = await addModuleAction(courseId, initialState, formDataWith({ title: 'Módulo 1' }));

    expect(result).toEqual({ ok: true });
    expect(addModuleExecuteMock).toHaveBeenCalledWith(
      instructorCtx,
      expect.objectContaining({
        courseId,
        academyId: instructorCtx.orgId,
        title: 'Módulo 1',
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });
});

describe('reorderModuleUpAction', () => {
  it('loads the ordered module ids, swaps the target up, and calls reorderModules', async () => {
    getCourseDetailExecuteMock.mockResolvedValue({
      course: { id: courseId },
      modules: [{ id: 'm-1' }, { id: 'm-2' }, { id: 'm-3' }],
    });
    const { reorderModuleUpAction } = await import('../../../src/app/dashboard/courses/actions');

    await reorderModuleUpAction(courseId, 'm-2', new FormData());

    expect(reorderModulesExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      courseId,
      orderedIds: ['m-2', 'm-1', 'm-3'],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });

  it('does NOT call reorderModules when the target is already first (no-op)', async () => {
    getCourseDetailExecuteMock.mockResolvedValue({
      course: { id: courseId },
      modules: [{ id: 'm-1' }, { id: 'm-2' }],
    });
    const { reorderModuleUpAction } = await import('../../../src/app/dashboard/courses/actions');

    await reorderModuleUpAction(courseId, 'm-1', new FormData());

    expect(reorderModulesExecuteMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });
});

describe('reorderModuleDownAction', () => {
  it('loads the ordered module ids, swaps the target down, and calls reorderModules', async () => {
    getCourseDetailExecuteMock.mockResolvedValue({
      course: { id: courseId },
      modules: [{ id: 'm-1' }, { id: 'm-2' }, { id: 'm-3' }],
    });
    const { reorderModuleDownAction } = await import('../../../src/app/dashboard/courses/actions');

    await reorderModuleDownAction(courseId, 'm-2', new FormData());

    expect(reorderModulesExecuteMock).toHaveBeenCalledWith(instructorCtx, {
      courseId,
      orderedIds: ['m-1', 'm-3', 'm-2'],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/courses/${courseId}`);
  });
});
