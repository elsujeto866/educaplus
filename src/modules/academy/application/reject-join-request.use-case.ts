import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { JoinRequest } from '../domain/entities/join-request.entity';
import { JoinRequestNotFoundError } from '../domain/errors';
import type { JoinRequestRepository } from '../domain/ports/join-request.repository';

export interface RejectJoinRequestInput {
  id: string;
}

/**
 * RejectJoinRequestUseCase — pending -> rejected, no invitation (Phase 3).
 *
 * Authorization: only `admin`/`instructor` may reject. Double-resolve is
 * rejected as a no-op (spec "Reject already-resolved request rejected") via
 * the same entity-level invariant `JoinRequest.reject()` already enforces
 * for Approve — no separate guard needed here.
 */
export class RejectJoinRequestUseCase {
  constructor(private readonly joinRequestRepo: JoinRequestRepository) {}

  async execute(ctx: TenantContext, input: RejectJoinRequestInput): Promise<JoinRequest> {
    assertRole(ctx, ['admin', 'instructor']);

    const joinRequest = await this.joinRequestRepo.findById(ctx, input.id);
    if (!joinRequest) throw new JoinRequestNotFoundError(input.id);

    const rejected = joinRequest.reject(ctx.userId);
    await this.joinRequestRepo.save(ctx, rejected);
    return rejected;
  }
}
