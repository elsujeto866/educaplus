import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Simulator } from '../domain/simulator.entity';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/**
 * GetPublishedSimulatorUseCase — student-facing detail read.
 *
 * Returns `null` for THREE cases, deliberately collapsed into one
 * not-found path so a draft simulator's title/rules never leak to a
 * student who guesses its id: (1) it does not exist, (2) it belongs to a
 * different tenant (RLS via `findById`), (3) it exists but is still
 * 'draft' (spec.md "Unpublished stays hidden"). Read-only — no
 * `assertRole` guard, any authenticated tenant member may view it.
 */
export class GetPublishedSimulatorUseCase {
  constructor(private readonly simulatorRepo: SimulatorRepository) {}

  async execute(ctx: TenantContext, id: string): Promise<Simulator | null> {
    const simulator = await this.simulatorRepo.findById(ctx, id);
    if (!simulator || !simulator.isPublished) return null;
    return simulator;
  }
}
