/**
 * Application use-case unit tests — FulfillJoinRequestUseCase (Phase 4,
 * reconciliation).
 *
 * Repository is mocked with vi.fn() — no DB. Covers spec "Approved Request
 * Fulfillment on Membership Sync" and "Orphan approved request has no day-1
 * expiry" (design D: match key is academyId + normalized email + status=
 * 'approved' + fulfilledAt IS NULL; idempotent; silent no-op when no match).
 */

import { describe, it, expect, vi } from 'vitest';
import { FulfillJoinRequestUseCase } from '../../../src/modules/academy/application/fulfill-join-request.use-case';
import { JoinRequest } from '../../../src/modules/academy/domain/entities/join-request.entity';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import type { JoinRequestRepository } from '../../../src/modules/academy/domain/ports/join-request.repository';

const now = new Date('2026-01-01T00:00:00Z');

const webhookCtx: TenantContext = { orgId: 'org_A', userId: 'system', role: 'admin' };

function makeRepo(): JoinRequestRepository {
  return {
    listPendingByAcademy: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    findApprovedUnfulfilled: vi.fn(),
  };
}

function makeApproved(): JoinRequest {
  return JoinRequest.createPending({
    id: 'jr-1',
    academyId: 'org_A',
    email: 'new@student.com',
    createdAt: now,
  }).approve('admin_1', now);
}

describe('FulfillJoinRequestUseCase', () => {
  it('marks the matching approved request fulfilled (spec: Webhook sync fulfills approved request)', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findApprovedUnfulfilled).mockResolvedValue(makeApproved());

    const useCase = new FulfillJoinRequestUseCase(repo);
    await useCase.execute(webhookCtx, {
      academyId: 'org_A',
      email: 'new@student.com',
      membershipId: 'membership-1',
    });

    expect(repo.findApprovedUnfulfilled).toHaveBeenCalledWith(webhookCtx, 'org_A', 'new@student.com');
    expect(repo.save).toHaveBeenCalledWith(
      webhookCtx,
      expect.objectContaining({ id: 'jr-1', fulfilledAt: expect.any(Date), membershipId: 'membership-1' }),
    );
  });

  it('normalizes the email (lowercase + trim) before matching', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findApprovedUnfulfilled).mockResolvedValue(null);

    const useCase = new FulfillJoinRequestUseCase(repo);
    await useCase.execute(webhookCtx, {
      academyId: 'org_A',
      email: ' New@Student.com ',
      membershipId: 'membership-1',
    });

    expect(repo.findApprovedUnfulfilled).toHaveBeenCalledWith(webhookCtx, 'org_A', 'new@student.com');
  });

  it('is a silent no-op when no matching approved request exists (spec: Orphan approved request has no day-1 expiry / member added directly by admin)', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findApprovedUnfulfilled).mockResolvedValue(null);

    const useCase = new FulfillJoinRequestUseCase(repo);
    await expect(
      useCase.execute(webhookCtx, { academyId: 'org_A', email: 'nobody@student.com', membershipId: 'membership-1' }),
    ).resolves.toBeUndefined();

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('is idempotent: re-running on an already-fulfilled request does not overwrite fulfilledAt/membershipId (webhook re-delivery)', async () => {
    const repo = makeRepo();
    const alreadyFulfilled = makeApproved().fulfill('membership-1', now);
    // findApprovedUnfulfilled only ever returns unfulfilled rows — a
    // re-delivery for an already-fulfilled request finds nothing.
    vi.mocked(repo.findApprovedUnfulfilled).mockResolvedValue(null);

    const useCase = new FulfillJoinRequestUseCase(repo);
    await useCase.execute(webhookCtx, {
      academyId: 'org_A',
      email: alreadyFulfilled.email,
      membershipId: 'membership-2',
    });

    expect(repo.save).not.toHaveBeenCalled();
  });
});
