/**
 * Application use-case unit tests — RejectJoinRequestUseCase.
 *
 * The repository is mocked with vi.fn() — no DB. Covers spec "Reject Closes
 * Request" (pending -> rejected, no invitation) and "Reject already-resolved
 * request rejected" (the action is rejected — no-op — mirrors Approve's
 * double-resolve guard, both backed by the same entity-level invariant).
 */

import { describe, it, expect, vi } from 'vitest';
import { RejectJoinRequestUseCase } from '../../../src/modules/academy/application/reject-join-request.use-case';
import { JoinRequest } from '../../../src/modules/academy/domain/entities/join-request.entity';
import { JoinRequestAlreadyResolvedError, JoinRequestNotFoundError } from '../../../src/modules/academy/domain/errors';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { JoinRequestRepository } from '../../../src/modules/academy/domain/ports/join-request.repository';

const now = new Date('2026-01-01T00:00:00Z');

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_A1', role: 'admin' };
const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_A3', role: 'student' };

function makeRepo(): JoinRequestRepository {
  return {
    listPendingByAcademy: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    findApprovedUnfulfilled: vi.fn(),
  };
}

function makePending(): JoinRequest {
  return JoinRequest.createPending({
    id: 'jr-1',
    academyId: 'org_A',
    email: 'new@student.com',
    createdAt: now,
  });
}

describe('RejectJoinRequestUseCase', () => {
  it('transitions pending -> rejected and sends no invitation (spec: Reject Closes Request)', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findById).mockResolvedValue(makePending());

    const useCase = new RejectJoinRequestUseCase(repo);
    const result = await useCase.execute(adminCtx, { id: 'jr-1' });

    expect(result.status).toBe('rejected');
    expect(result.resolvedBy).toBe(adminCtx.userId);
    expect(repo.save).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ id: 'jr-1', status: 'rejected' }));
  });

  it('rejects (no-op) when the request is already resolved (spec: Reject already-resolved request rejected)', async () => {
    const repo = makeRepo();
    const alreadyRejected = makePending().reject('admin_previous', now);
    vi.mocked(repo.findById).mockResolvedValue(alreadyRejected);

    const useCase = new RejectJoinRequestUseCase(repo);

    await expect(useCase.execute(adminCtx, { id: 'jr-1' })).rejects.toThrow(JoinRequestAlreadyResolvedError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('denies a student (role guard)', async () => {
    const repo = makeRepo();
    const useCase = new RejectJoinRequestUseCase(repo);

    await expect(useCase.execute(studentCtx, { id: 'jr-1' })).rejects.toThrow(UnauthorizedError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('throws JoinRequestNotFoundError when the id does not resolve in the caller academy', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findById).mockResolvedValue(null);

    const useCase = new RejectJoinRequestUseCase(repo);

    await expect(useCase.execute(adminCtx, { id: 'unknown' })).rejects.toThrow(JoinRequestNotFoundError);
  });
});
