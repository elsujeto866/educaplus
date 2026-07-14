/**
 * Application use-case unit tests — ListPendingJoinRequestsUseCase.
 *
 * The repository is mocked with vi.fn() — no DB, no infrastructure.
 * Verifies: (1) role guard — only admin/instructor may list; student is
 * denied, (2) tenant-scoped delegation — the repo is called with `ctx` so
 * cross-academy isolation is enforced at the repository/RLS layer, this
 * use-case just orchestrates + guards the role (spec "Role- and
 * Tenant-Scoped Queue Access", "Student role denied", "Cross-academy
 * isolation").
 */

import { describe, it, expect, vi } from 'vitest';
import { ListPendingJoinRequestsUseCase } from '../../../src/modules/academy/application/list-pending-join-requests.use-case';
import { JoinRequest } from '../../../src/modules/academy/domain/entities/join-request.entity';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { JoinRequestRepository } from '../../../src/modules/academy/domain/ports/join-request.repository';

const now = new Date('2026-01-01T00:00:00Z');

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_A1', role: 'admin' };
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_A2', role: 'instructor' };
const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_A3', role: 'student' };

function makeRepo(): JoinRequestRepository {
  return {
    listPendingByAcademy: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    findApprovedUnfulfilled: vi.fn(),
  };
}

function makePending(id: string): JoinRequest {
  return JoinRequest.createPending({ id, academyId: 'org_A', email: `${id}@student.com`, createdAt: now });
}

describe('ListPendingJoinRequestsUseCase', () => {
  it('returns the pending requests for the caller academy (admin)', async () => {
    const repo = makeRepo();
    const pending = [makePending('jr-1'), makePending('jr-2')];
    vi.mocked(repo.listPendingByAcademy).mockResolvedValue(pending);

    const useCase = new ListPendingJoinRequestsUseCase(repo);
    const result = await useCase.execute(adminCtx);

    expect(repo.listPendingByAcademy).toHaveBeenCalledWith(adminCtx);
    expect(result).toBe(pending);
  });

  it('allows an instructor to list', async () => {
    const repo = makeRepo();
    vi.mocked(repo.listPendingByAcademy).mockResolvedValue([]);

    const useCase = new ListPendingJoinRequestsUseCase(repo);
    await expect(useCase.execute(instructorCtx)).resolves.toEqual([]);
  });

  it('denies a student (spec: Student role denied)', async () => {
    const repo = makeRepo();
    const useCase = new ListPendingJoinRequestsUseCase(repo);

    await expect(useCase.execute(studentCtx)).rejects.toThrow(UnauthorizedError);
    expect(repo.listPendingByAcademy).not.toHaveBeenCalled();
  });
});
