import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrack } from '../domain/simulator-track.entity';
import type { SimulatorTrackStep } from '../domain/simulator-track-step.entity';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';

export interface TrackDetailView {
  track: SimulatorTrack;
  steps: SimulatorTrackStep[];
}

/**
 * GetTrackDetailUseCase — reads a single track's full authoring view model:
 * the track plus its ordered steps (`stepRepo.findByTrack` returns them
 * ordered by position ascending).
 *
 * Read-only: no `assertRole` guard — page-level gating decides who may reach
 * this use-case. Returns `null` when the track does not exist OR belongs to
 * a different tenant (`trackRepo.findById` is already RLS/ctx-scoped) — this
 * is the single not-found/cross-tenant path, no data leak. Mirrors
 * `GetBankDetailUseCase`.
 */
export class GetTrackDetailUseCase {
  constructor(
    private readonly trackRepo: SimulatorTrackRepository,
    private readonly stepRepo: SimulatorTrackStepRepository,
  ) {}

  async execute(ctx: TenantContext, trackId: string): Promise<TrackDetailView | null> {
    const track = await this.trackRepo.findById(ctx, trackId);
    if (!track) return null;

    const steps = await this.stepRepo.findByTrack(ctx, trackId);
    return { track, steps };
  }
}
