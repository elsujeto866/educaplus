import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Simulator } from '../domain/simulator.entity';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/**
 * ListSimulatorsUseCase — admin/instructor authoring read: ALL simulators
 * (draft + published) for the tenant academy. Read-only — no `assertRole`
 * guard; page-level gating (`requireInstructor`) decides who reaches this
 * route. Mirrors `ListBanksUseCase`.
 */
export class ListSimulatorsUseCase {
  constructor(private readonly simulatorRepo: SimulatorRepository) {}

  async execute(ctx: TenantContext): Promise<Simulator[]> {
    return this.simulatorRepo.findByAcademy(ctx, ctx.orgId);
  }
}
