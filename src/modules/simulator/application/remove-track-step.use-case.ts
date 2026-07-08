import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrackStep } from '../domain/simulator-track-step.entity';
import { SimulatorTrackNotFoundError, SimulatorTrackStepNotFoundError } from '../domain/errors';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';

export interface RemoveTrackStepInput {
  trackId: string;
  stepId: string;
}

/**
 * RemoveTrackStepUseCase
 *
 * Deletes a step and re-compacts the remaining steps' positions back to a
 * contiguous 1..N sequence (spec.md "Remove a step": "remaining steps
 * re-sequence ... contiguously"). The delete and the re-compaction run as
 * ONE atomic repository call (`removeAndRecompact`) — a single
 * `withTenant`/`db.transaction` — so a failure between them can never leave
 * a position gap (which two separate transactions would risk).
 *
 * Authorization: admin or instructor.
 */
export class RemoveTrackStepUseCase {
  constructor(
    private readonly trackRepo: SimulatorTrackRepository,
    private readonly stepRepo: SimulatorTrackStepRepository,
  ) {}

  async execute(ctx: TenantContext, input: RemoveTrackStepInput): Promise<SimulatorTrackStep[]> {
    assertRole(ctx, ['admin', 'instructor']);

    const track = await this.trackRepo.findById(ctx, input.trackId);
    if (!track) throw new SimulatorTrackNotFoundError(input.trackId);

    const existing = await this.stepRepo.findByTrack(ctx, input.trackId);
    const target = existing.find((s) => s.id === input.stepId);
    if (!target) throw new SimulatorTrackStepNotFoundError(input.stepId);

    const now = new Date();
    const remaining = existing
      .filter((s) => s.id !== input.stepId)
      .sort((a, b) => a.position - b.position)
      .map((s, index) => s.withPosition(index + 1, now));

    await this.stepRepo.removeAndRecompact(
      ctx,
      input.stepId,
      remaining.map((s) => ({ id: s.id, position: s.position })),
    );

    return remaining;
  }
}
