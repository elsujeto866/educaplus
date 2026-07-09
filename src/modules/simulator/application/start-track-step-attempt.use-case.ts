import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorAttempt } from '../domain/simulator-attempt.entity';
import { StepLockedError } from '../domain/errors';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';
import type { SimulatorTrackProgressRepository } from '../domain/ports/simulator-track-progress.repository';

export interface StartTrackStepAttemptInput {
  /** Caller-supplied UUID for a NEW attempt row — forwarded as-is to the delegate. */
  id: string;
  simulatorId: string;
}

/**
 * Structural contract for the delegate collaborator — satisfied by the
 * shipped `StartAttemptUseCase` WITHOUT importing it. Mirrors
 * `GetTrackForLearnerUseCase`'s `ProgressAdvancer` trick verbatim: the
 * `boundaries/dependencies` ESLint rule forbids `application` ->
 * `application` imports even within the same module (own-domain-only, no
 * cross-use-case coupling), so this use-case depends on a local structural
 * type instead. The composition root (which IS allowed to import both)
 * wires the real `StartAttemptUseCase` instance in, relying on
 * TypeScript's structural typing to satisfy this interface.
 */
export interface AttemptStarter {
  execute(ctx: TenantContext, input: { id: string; simulatorId: string }): Promise<SimulatorAttempt>;
}

/**
 * StartTrackStepAttemptUseCase — THE locked-step gate (Phase 6, spec.md
 * "Reject attempt on locked step").
 *
 * The shipped `StartAttemptUseCase`/`startAttemptAction` starts an attempt
 * on any published simulator with NO track-lock check (by design — Slice
 * S4 predates tracks entirely). This use-case COMPOSES AROUND it instead of
 * editing it: it is injected the real `StartAttemptUseCase` instance and
 * delegates to it verbatim once (and only once) the lock check clears.
 *
 * Lock derivation mirrors `GetTrackForLearnerUseCase`/
 * `AdvanceProgressOnPassUseCase` EXACTLY (same frontier formula, same
 * owner-only `ctx.userId` scoping — never an input-supplied user):
 *   1. `stepRepo.findBySimulator` — if the simulator is not part of ANY
 *      track, this is a standalone simulator: no gate applies, delegate
 *      straight through.
 *   2. `progressRepo.findByTrackAndUser` — the learner's current frontier,
 *      or the IMPLICIT default of 1 when no row exists yet (step 1 open by
 *      default).
 *   3. `step.position > frontier` → LOCKED → throw `StepLockedError`
 *      BEFORE ever calling `startAttempt.execute` (no attempt row is ever
 *      created for a locked step — this is also why no separate SUBMIT-side
 *      gate is needed: an attempt can only exist for a step that passed
 *      this check at START time).
 *      `step.position <= frontier` (currently unlocked OR already passed) →
 *      allowed, including re-taking an already-passed step.
 */
export class StartTrackStepAttemptUseCase {
  constructor(
    private readonly stepRepo: SimulatorTrackStepRepository,
    private readonly progressRepo: SimulatorTrackProgressRepository,
    private readonly startAttempt: AttemptStarter,
  ) {}

  async execute(ctx: TenantContext, input: StartTrackStepAttemptInput): Promise<SimulatorAttempt> {
    const step = await this.stepRepo.findBySimulator(ctx, input.simulatorId);

    if (step) {
      const progress = await this.progressRepo.findByTrackAndUser(ctx, step.trackId, ctx.userId);
      const frontier = progress?.highestUnlockedPosition ?? 1;

      if (step.position > frontier) {
        throw new StepLockedError(input.simulatorId);
      }
    }

    return this.startAttempt.execute(ctx, { id: input.id, simulatorId: input.simulatorId });
  }
}
