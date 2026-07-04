import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Simulator } from '../domain/simulator.entity';
import { SimulatorNotFoundError } from '../domain/errors';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

export interface UnpublishSimulatorInput {
  id: string;
}

/**
 * UnpublishSimulatorUseCase — sets a simulator back to 'draft', hiding it
 * from the student catalog immediately. No pool check needed (unlike
 * publish) — going to draft never has an "insufficient" failure mode.
 *
 * Authorization: admin or instructor.
 */
export class UnpublishSimulatorUseCase {
  constructor(private readonly simulatorRepo: SimulatorRepository) {}

  async execute(ctx: TenantContext, input: UnpublishSimulatorInput): Promise<Simulator> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.simulatorRepo.findById(ctx, input.id);
    if (!existing) throw new SimulatorNotFoundError(input.id);

    const unpublished = existing.unpublish();
    await this.simulatorRepo.update(ctx, unpublished);
    return unpublished;
  }
}
