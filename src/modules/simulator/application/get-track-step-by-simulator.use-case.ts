import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrackStep } from '../domain/simulator-track-step.entity';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';

/**
 * GetTrackStepBySimulatorUseCase — thin read pass-through over
 * `SimulatorTrackStepRepository.findBySimulator`.
 *
 * Added in Phase 6 SOLELY so delivery layers (which may only reach
 * `application` through `composition`, never `domain`/`infrastructure`
 * directly — eslint-boundaries) can ask "is this simulator a track step?"
 * without a bespoke repository method reaching delivery. Backs the
 * standalone-catalog/detail bypass fix (design.md follow-up): a simulator
 * that is a step of ANY track is excluded from the standalone learner
 * catalog/detail routes, forcing learners through the gated track
 * level-map (`GetTrackForLearnerUseCase` / `StartTrackStepAttemptUseCase`)
 * instead — no edits to `ListPublishedSimulatorsUseCase`,
 * `GetPublishedSimulatorUseCase`, `StartAttemptUseCase`, or
 * `startAttemptAction`.
 */
export class GetTrackStepBySimulatorUseCase {
  constructor(private readonly stepRepo: SimulatorTrackStepRepository) {}

  async execute(ctx: TenantContext, simulatorId: string): Promise<SimulatorTrackStep | null> {
    return this.stepRepo.findBySimulator(ctx, simulatorId);
  }
}
