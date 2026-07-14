import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { JoinRequest } from '../domain/entities/join-request.entity';
import type { JoinRequestRepository } from '../domain/ports/join-request.repository';

/**
 * ListPendingJoinRequestsUseCase — admin approval queue read (Phase 3).
 *
 * Authorization: only `admin`/`instructor` may list (spec "Role- and
 * Tenant-Scoped Queue Access", "Student role denied"). Tenant scoping
 * (spec "Cross-academy isolation") is enforced by the repository via
 * `withTenant`/RLS — this use-case only guards the role and delegates.
 */
export class ListPendingJoinRequestsUseCase {
  constructor(private readonly joinRequestRepo: JoinRequestRepository) {}

  async execute(ctx: TenantContext): Promise<JoinRequest[]> {
    assertRole(ctx, ['admin', 'instructor']);
    return this.joinRequestRepo.listPendingByAcademy(ctx);
  }
}
