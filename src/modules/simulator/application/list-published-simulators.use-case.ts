import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Simulator } from '../domain/simulator.entity';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/**
 * ListPublishedSimulatorsUseCase — reads the tenant-scoped PUBLISHED
 * simulator catalog (spec.md "Browse published simulators": standalone,
 * no course enrollment required).
 *
 * Read-only: no `assertRole` guard — any authenticated tenant member may
 * browse the catalog, mirrors `ListPublishedCoursesUseCase`. Filters to
 * `status = 'published'` in SQL via `findPublishedByAcademy` to avoid
 * loading drafts into memory (spec.md "Unpublished stays hidden").
 */
export class ListPublishedSimulatorsUseCase {
  constructor(private readonly simulatorRepo: SimulatorRepository) {}

  async execute(ctx: TenantContext): Promise<Simulator[]> {
    return this.simulatorRepo.findPublishedByAcademy(ctx, ctx.orgId);
  }
}
