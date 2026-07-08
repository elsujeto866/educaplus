import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrackStep } from '../domain/simulator-track-step.entity';
import { SimulatorTrackNotFoundError, InvalidSimulatorTrackStepError } from '../domain/errors';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';

export interface ReorderTrackStepsInput {
  trackId: string;
  /**
   * Step ids in their desired new order — MUST be exactly the current set
   * of step ids for this track, each listed once (spec.md "Reorder steps").
   * This use-case only reassigns positions; it never adds or removes steps.
   */
  orderedStepIds: string[];
}

/**
 * ReorderTrackStepsUseCase
 *
 * Rewrites every step's position to its index in `orderedStepIds` + 1,
 * keeping the sequence contiguous 1..N by construction (design.md
 * "SimulatorTrackStep ... contiguous 1..n per track"). Validates that
 * `orderedStepIds` is a permutation of the track's current step ids before
 * writing anything — a missing/extra/duplicate id is rejected as
 * `InvalidSimulatorTrackStepError` with zero partial writes.
 *
 * Authorization: admin or instructor.
 */
export class ReorderTrackStepsUseCase {
  constructor(
    private readonly trackRepo: SimulatorTrackRepository,
    private readonly stepRepo: SimulatorTrackStepRepository,
  ) {}

  async execute(ctx: TenantContext, input: ReorderTrackStepsInput): Promise<SimulatorTrackStep[]> {
    assertRole(ctx, ['admin', 'instructor']);

    const track = await this.trackRepo.findById(ctx, input.trackId);
    if (!track) throw new SimulatorTrackNotFoundError(input.trackId);

    const existing = await this.stepRepo.findByTrack(ctx, input.trackId);
    const existingIds = new Set(existing.map((s) => s.id));
    const requestedIds = new Set(input.orderedStepIds);
    const isExactPermutation =
      input.orderedStepIds.length === existing.length &&
      requestedIds.size === input.orderedStepIds.length &&
      input.orderedStepIds.every((id) => existingIds.has(id));

    if (!isExactPermutation) {
      throw new InvalidSimulatorTrackStepError(
        'orderedStepIds must be exactly the current set of step ids for this track, each listed once',
      );
    }

    const now = new Date();
    const byId = new Map(existing.map((s) => [s.id, s]));
    const reordered = input.orderedStepIds.map((id, index) => byId.get(id)!.withPosition(index + 1, now));

    await this.stepRepo.replacePositions(
      ctx,
      reordered.map((s) => ({ id: s.id, position: s.position })),
    );

    return reordered;
  }
}
