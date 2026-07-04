import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Simulator } from '../domain/simulator.entity';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/**
 * GetSimulatorUseCase — admin/instructor read of a single simulator by id,
 * regardless of publish status (used by the rule-builder edit page).
 * Read-only — no `assertRole` guard; page-level gating decides who reaches
 * this route. Returns `null` when the simulator does not exist OR belongs
 * to a different tenant (simulatorRepo.findById is already RLS/ctx-scoped)
 * — single not-found/cross-tenant path, no data leak. Mirrors
 * `GetBankDetailUseCase`'s null-on-miss contract.
 */
export class GetSimulatorUseCase {
  constructor(private readonly simulatorRepo: SimulatorRepository) {}

  async execute(ctx: TenantContext, id: string): Promise<Simulator | null> {
    return this.simulatorRepo.findById(ctx, id);
  }
}
