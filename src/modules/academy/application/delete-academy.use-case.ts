import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { AcademyRepository } from '../domain/ports/academy.repository';

/**
 * DeleteAcademyUseCase — soft-deletes an academy (sets deleted_at).
 *
 * Called by the Clerk webhook delivery layer for `organization.deleted` events.
 * Soft-delete is idempotent: calling again on an already-deleted academy is a no-op
 * at the repository level.
 *
 * Authorization: only callers with `admin` role may delete.
 */
export class DeleteAcademyUseCase {
  constructor(private readonly academyRepo: AcademyRepository) {}

  async execute(ctx: TenantContext, academyId: string): Promise<void> {
    assertRole(ctx, ['admin']);
    await this.academyRepo.softDelete(ctx, academyId);
  }
}
