import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrack } from '../domain/simulator-track.entity';
import { SimulatorTrackNotFoundError, EmptyTrackError } from '../domain/errors';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';

export interface PublishTrackInput {
  id: string;
}

/**
 * PublishTrackUseCase
 *
 * Mirrors `PublishSimulatorUseCase`'s immutable-transition + publish-time
 * gate shape verbatim. The gate here checks STEP COUNT (via
 * `stepRepo.countByTrack`) instead of a question pool — a track with zero
 * steps has nothing for a learner to progress through, so publish is
 * rejected with `EmptyTrackError` (same rationale as
 * `InsufficientQuestionPoolError`: publish-time is the fail-fast gate, the
 * entity constructor itself stays permissive for rehydration).
 *
 * Authorization: admin or instructor.
 */
export class PublishTrackUseCase {
  constructor(
    private readonly trackRepo: SimulatorTrackRepository,
    private readonly stepRepo: SimulatorTrackStepRepository,
  ) {}

  async execute(ctx: TenantContext, input: PublishTrackInput): Promise<SimulatorTrack> {
    assertRole(ctx, ['admin', 'instructor']);

    const existing = await this.trackRepo.findById(ctx, input.id);
    if (!existing) throw new SimulatorTrackNotFoundError(input.id);

    const stepCount = await this.stepRepo.countByTrack(ctx, existing.id);
    if (stepCount === 0) throw new EmptyTrackError(existing.id);

    const published = existing.publish();
    await this.trackRepo.update(ctx, published);
    return published;
  }
}
