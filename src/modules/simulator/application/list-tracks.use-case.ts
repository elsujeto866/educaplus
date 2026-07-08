import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrack } from '../domain/simulator-track.entity';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';

/**
 * ListTracksUseCase — reads the tenant-scoped gamified track list.
 *
 * Read-only: no `assertRole` guard — page-level gating (requireInstructor)
 * decides who may reach this use-case. Mirrors `ListBanksUseCase`.
 */
export class ListTracksUseCase {
  constructor(private readonly trackRepo: SimulatorTrackRepository) {}

  async execute(ctx: TenantContext): Promise<SimulatorTrack[]> {
    return this.trackRepo.findByAcademy(ctx, ctx.orgId);
  }
}
