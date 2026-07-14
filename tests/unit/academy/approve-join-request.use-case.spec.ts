/**
 * Application use-case unit tests — ApproveJoinRequestUseCase.
 *
 * Both the repository AND the InvitationPort are mocked with vi.fn() — no
 * DB, no live Clerk call (per apply instructions: the real Clerk invitation
 * is deferred to the user's environment; this test only exercises the
 * use-case's orchestration against a MOCKED port). Covers spec "Approve
 * Sends Invitation" and "Approve already-resolved request rejected", plus
 * task 3.5's already-member idempotency contract (simulated here by the
 * mocked InvitationPort simply resolving — the actual idempotent-catch
 * behavior lives in ClerkInvitationAdapter and is tested separately in
 * clerk-invitation.adapter.spec.ts).
 */

import { describe, it, expect, vi } from 'vitest';
import { ApproveJoinRequestUseCase } from '../../../src/modules/academy/application/approve-join-request.use-case';
import { JoinRequest } from '../../../src/modules/academy/domain/entities/join-request.entity';
import { JoinRequestAlreadyResolvedError, JoinRequestNotFoundError } from '../../../src/modules/academy/domain/errors';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { JoinRequestRepository } from '../../../src/modules/academy/domain/ports/join-request.repository';
import type { InvitationPort } from '../../../src/modules/academy/domain/ports/invitation.port';

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

function makeInvitationPort(): InvitationPort {
  return { inviteToAcademy: vi.fn() };
}

function makePending(): JoinRequest {
  return JoinRequest.createPending({
    id: 'jr-1',
    academyId: 'org_A',
    email: 'new@student.com',
    createdAt: now,
  });
}

describe('ApproveJoinRequestUseCase', () => {
  it('transitions pending -> approved and sends a student invitation (spec: Approve Sends Invitation)', async () => {
    const repo = makeRepo();
    const invitationPort = makeInvitationPort();
    vi.mocked(repo.findById).mockResolvedValue(makePending());
    vi.mocked(invitationPort.inviteToAcademy).mockResolvedValue(undefined);

    const useCase = new ApproveJoinRequestUseCase(repo, invitationPort);
    const result = await useCase.execute(adminCtx, { id: 'jr-1' });

    expect(result.status).toBe('approved');
    expect(result.resolvedBy).toBe(adminCtx.userId);
    expect(invitationPort.inviteToAcademy).toHaveBeenCalledWith({
      academyId: 'org_A',
      email: 'new@student.com',
      role: 'student',
      invitedBy: adminCtx.userId,
    });
    expect(repo.save).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ id: 'jr-1', status: 'approved' }));
  });

  it('rejects approving an already-resolved request and sends no duplicate invitation (spec: Approve already-resolved request rejected)', async () => {
    const repo = makeRepo();
    const invitationPort = makeInvitationPort();
    const alreadyApproved = makePending().approve('admin_previous', now);
    vi.mocked(repo.findById).mockResolvedValue(alreadyApproved);

    const useCase = new ApproveJoinRequestUseCase(repo, invitationPort);

    await expect(useCase.execute(adminCtx, { id: 'jr-1' })).rejects.toThrow(JoinRequestAlreadyResolvedError);
    expect(invitationPort.inviteToAcademy).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('denies a student (role guard)', async () => {
    const repo = makeRepo();
    const invitationPort = makeInvitationPort();

    const useCase = new ApproveJoinRequestUseCase(repo, invitationPort);

    await expect(useCase.execute(studentCtx, { id: 'jr-1' })).rejects.toThrow(UnauthorizedError);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('throws JoinRequestNotFoundError when the id does not resolve in the caller academy', async () => {
    const repo = makeRepo();
    const invitationPort = makeInvitationPort();
    vi.mocked(repo.findById).mockResolvedValue(null);

    const useCase = new ApproveJoinRequestUseCase(repo, invitationPort);

    await expect(useCase.execute(adminCtx, { id: 'unknown' })).rejects.toThrow(JoinRequestNotFoundError);
    expect(invitationPort.inviteToAcademy).not.toHaveBeenCalled();
  });

  it('does not persist when the invitation port rejects (genuine failure, not idempotent)', async () => {
    const repo = makeRepo();
    const invitationPort = makeInvitationPort();
    vi.mocked(repo.findById).mockResolvedValue(makePending());
    vi.mocked(invitationPort.inviteToAcademy).mockRejectedValue(new Error('network error'));

    const useCase = new ApproveJoinRequestUseCase(repo, invitationPort);

    await expect(useCase.execute(adminCtx, { id: 'jr-1' })).rejects.toThrow('network error');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
