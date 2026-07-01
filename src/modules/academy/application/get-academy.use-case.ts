import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Academy } from '../domain/academy.entity';
import type { AcademyRepository } from '../domain/ports/academy.repository';

/**
 * GetAcademyUseCase — reads the tenant-scoped academy.
 *
 * Read-only: no `assertRole` guard, any authenticated member of the tenant
 * may read their own academy. Returns `null` when the academy has not been
 * provisioned yet (e.g. webhook race — caller is responsible for lazy-ensure).
 */
export class GetAcademyUseCase {
  constructor(private readonly academyRepo: AcademyRepository) {}

  async execute(ctx: TenantContext): Promise<Academy | null> {
    return this.academyRepo.findById(ctx, ctx.orgId);
  }
}
