import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrack } from '../domain/simulator-track.entity';
import type { SimulatorTrackProgress } from '../domain/simulator-track-progress.entity';
import { SimulatorTrackNotFoundError } from '../domain/errors';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';
import type { SimulatorTrackProgressRepository } from '../domain/ports/simulator-track-progress.repository';

/**
 * Structural contract for the frontier-reconciliation collaborator —
 * satisfied by `AdvanceProgressOnPassUseCase` WITHOUT importing it. The
 * `boundaries/dependencies` ESLint rule forbids `application` -> `application`
 * imports even within the same module (own-domain-only, no cross-use-case
 * coupling); the composition root (which IS allowed to import both) wires the
 * real `AdvanceProgressOnPassUseCase` instance in, relying on TypeScript's
 * structural typing to satisfy this interface.
 */
export interface ProgressAdvancer {
  execute(
    ctx: TenantContext,
    input: { simulatorId: string; progressId: string },
  ): Promise<SimulatorTrackProgress | null>;
}

export interface GetTrackForLearnerInput {
  trackId: string;
  /**
   * Caller-supplied UUID forwarded to `AdvanceProgressOnPassUseCase` for a
   * NEW progress row, in case this call is the learner's first-ever
   * reconciliation on this track. Ignored when a progress row already
   * exists.
   */
  progressId: string;
}

export type TrackStepStatus = 'locked' | 'unlocked' | 'passed';

export interface TrackStepView {
  stepId: string;
  simulatorId: string;
  position: number;
  status: TrackStepStatus;
}

export interface TrackForLearnerView {
  track: SimulatorTrack;
  steps: TrackStepView[];
}

/**
 * GetTrackForLearnerUseCase — the gamified level-map read model.
 *
 * THE lazy-on-view reconciliation seam (design.md "Progression triggered
 * lazily on track-map view (NOT by editing SubmitAttempt)"): every call
 * first asks `AdvanceProgressOnPassUseCase` to reconcile the frontier
 * against the learner's attempt history for whatever step CURRENTLY sits at
 * the frontier. Since a learner can only ever pass the frontier step, one
 * reconciliation call per view is enough — if they already passed it, the
 * frontier advances by exactly 1 before any status is derived; if not, the
 * call is a no-op (idempotent, side-effect-free on the happy "still locked"
 * path).
 *
 * Status derivation, once the frontier is up to date, is pure and total:
 *   position <  frontier -> 'passed'
 *   position == frontier -> 'unlocked'
 *   position >  frontier -> 'locked'
 */
export class GetTrackForLearnerUseCase {
  constructor(
    private readonly trackRepo: SimulatorTrackRepository,
    private readonly stepRepo: SimulatorTrackStepRepository,
    private readonly progressRepo: SimulatorTrackProgressRepository,
    private readonly advanceProgressOnPass: ProgressAdvancer,
  ) {}

  async execute(ctx: TenantContext, input: GetTrackForLearnerInput): Promise<TrackForLearnerView> {
    const track = await this.trackRepo.findById(ctx, input.trackId);
    if (!track) throw new SimulatorTrackNotFoundError(input.trackId);

    const steps = await this.stepRepo.findByTrack(ctx, input.trackId);

    const progress = await this.progressRepo.findByTrackAndUser(ctx, input.trackId, ctx.userId);
    let frontier = progress?.highestUnlockedPosition ?? 1;

    const frontierStep = steps.find((step) => step.position === frontier);
    if (frontierStep) {
      const advanced = await this.advanceProgressOnPass.execute(ctx, {
        simulatorId: frontierStep.simulatorId,
        progressId: input.progressId,
      });
      if (advanced) frontier = advanced.highestUnlockedPosition;
    }

    const stepViews: TrackStepView[] = steps.map((step) => ({
      stepId: step.id,
      simulatorId: step.simulatorId,
      position: step.position,
      status: step.position < frontier ? 'passed' : step.position === frontier ? 'unlocked' : 'locked',
    }));

    return { track, steps: stepViews };
  }
}
