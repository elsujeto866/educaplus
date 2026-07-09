import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrack } from '../domain/simulator-track.entity';
import { SimulatorTrackNotFoundError } from '../domain/errors';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';

export interface UnpublishTrackInput {
  id: string;
}

/**
 * UnpublishTrackUseCase — sets a track back to 'draft'. No step-count check
 * needed (unlike publish) — going to draft never has an "insufficient"
 * failure mode. Mirrors `UnpublishSimulatorUseCase` verbatim.
 *
 * Authorization: admin or instructor.
 */
export class UnpublishTrackUseCase {
  constructor(private readonly trackRepo: SimulatorTrackRepository) {}

  async execute(ctx: TenantContext, input: UnpublishTrackInput): Promise<SimulatorTrack> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.trackRepo.findById(ctx, input.id);
    if (!existing) throw new SimulatorTrackNotFoundError(input.id);

    const unpublished = existing.unpublish();
    await this.trackRepo.update(ctx, unpublished);
    return unpublished;
  }
}
