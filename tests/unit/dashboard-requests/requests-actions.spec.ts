/**
 * approveJoinRequestAction / rejectJoinRequestAction unit tests — the
 * tenant-scoped Server Actions bound to /dashboard/requests' approve/reject
 * buttons (task 3.7). Fire-and-forget void actions (bound with
 * `.bind(null, id)`), mirroring `dashboard/courses/actions.ts`'
 * publish/unpublish/delete pattern: errors propagate to Next's error
 * boundary rather than a Spanish inline message (page-level
 * `requireInstructor` already restricts who reaches these buttons).
 *
 * Mocks:
 *  - '@/shared/infrastructure/auth/clerk' → getTenantContext
 *  - '@/modules/academy/composition' → makeAcademyComposition
 *  - 'next/cache' → revalidatePath (no real Next.js runtime in unit tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getTenantContextMock = vi.fn();
vi.mock('@/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: getTenantContextMock,
}));

const approveExecuteMock = vi.fn();
const rejectExecuteMock = vi.fn();
vi.mock('@/modules/academy/composition', () => ({
  makeAcademyComposition: () => ({
    approveJoinRequest: { execute: approveExecuteMock },
    rejectJoinRequest: { execute: rejectExecuteMock },
  }),
}));

const revalidatePathMock = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

const adminCtx = { orgId: 'org_A', userId: 'user_A1', role: 'admin' as const };

describe('approveJoinRequestAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(adminCtx);
    approveExecuteMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it('resolves the caller TenantContext and delegates to ApproveJoinRequestUseCase', async () => {
    const { approveJoinRequestAction } = await import('../../../src/app/dashboard/requests/actions');

    await approveJoinRequestAction('jr-1', new FormData());

    expect(getTenantContextMock).toHaveBeenCalled();
    expect(approveExecuteMock).toHaveBeenCalledWith(adminCtx, { id: 'jr-1' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/requests');
  });

  it('propagates a use-case failure (e.g. already-resolved) without swallowing it', async () => {
    approveExecuteMock.mockRejectedValue(new Error('Join request "jr-1" has already been resolved'));
    const { approveJoinRequestAction } = await import('../../../src/app/dashboard/requests/actions');

    await expect(approveJoinRequestAction('jr-1', new FormData())).rejects.toThrow('already been resolved');
  });
});

describe('rejectJoinRequestAction', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(adminCtx);
    rejectExecuteMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it('resolves the caller TenantContext and delegates to RejectJoinRequestUseCase', async () => {
    const { rejectJoinRequestAction } = await import('../../../src/app/dashboard/requests/actions');

    await rejectJoinRequestAction('jr-1', new FormData());

    expect(getTenantContextMock).toHaveBeenCalled();
    expect(rejectExecuteMock).toHaveBeenCalledWith(adminCtx, { id: 'jr-1' });
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/requests');
  });
});
