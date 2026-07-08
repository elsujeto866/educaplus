import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrackProgress } from '../domain/simulator-track-progress.entity';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';
import type { SimulatorAttemptRepository } from '../domain/ports/simulator-attempt.repository';
import type { SimulatorTrackProgressRepository } from '../domain/ports/simulator-track-progress.repository';

export interface AdvanceProgressOnPassInput {
  simulatorId: string;
  /**
   * Caller-supplied UUID for a NEW progress row — used only when the
   * learner has no progress row yet for this track (their very first
   * advance beyond the implicit default frontier of 1). Ignored when a row
   * already exists (mirrors `IssueSimulatorCertificateInput.id`'s
   * caller-supplied-id convention).
   */
  progressId: string;
}

/**
 * AdvanceProgressOnPassUseCase (design.md "Progression triggered lazily on
 * track-map view") — advances the learner's frontier integer for a track.
 *
 * Invoked AFTER a passed submission (or lazily, on-view, from
 * `GetTrackForLearnerUseCase`) — NEVER embedded inside `SubmitAttemptUseCase`
 * itself:
 *   1. stepRepo.findBySimulator — if the simulator is not part of ANY track,
 *      no-op (null): nothing to advance.
 *   2. attemptRepo.findLatestPassed, scoped to ctx.userId (OWNER-ONLY,
 *      NEVER an input-supplied user) — null means the caller has never
 *      passed this simulator; no-op (defense-in-depth pass-gate).
 *   3. progressRepo.findByTrackAndUser — the learner's current frontier, or
 *      the IMPLICIT default of 1 when no row exists yet (step 1 open by
 *      default).
 *   4. Only the step AT the frontier can ever be advanced — a learner can
 *      only start/pass the currently-unlocked step. If `step.position !==
 *      frontier`, no-op either way (already advanced past it — idempotent
 *      re-pass — or, defensively, ahead of it — unreachable in practice).
 *      Otherwise `advanceTo(frontier + 1)` and persist via
 *      `progressRepo.upsertAdvance` — a SINGLE monotonic upsert (creates the
 *      row if this is the learner's first-ever advance, or advances an
 *      existing one), never a separate create/update pair.
 *   5. Race safety: `upsertAdvance` is a DB-level `GREATEST`-based upsert on
 *      `unique(track_id, clerk_user_id)` — it can never regress the
 *      persisted frontier even under two overlapping calls, so the use-case
 *      returns exactly what the repository persisted (the source of truth),
 *      not its own locally-computed candidate.
 */
export class AdvanceProgressOnPassUseCase {
  constructor(
    private readonly stepRepo: SimulatorTrackStepRepository,
    private readonly attemptRepo: SimulatorAttemptRepository,
    private readonly progressRepo: SimulatorTrackProgressRepository,
  ) {}

  async execute(
    ctx: TenantContext,
    input: AdvanceProgressOnPassInput,
  ): Promise<SimulatorTrackProgress | null> {
    const step = await this.stepRepo.findBySimulator(ctx, input.simulatorId);
    if (!step) return null;

    const passed = await this.attemptRepo.findLatestPassed(ctx, input.simulatorId, ctx.userId);
    if (!passed) return null;

    const existing = await this.progressRepo.findByTrackAndUser(ctx, step.trackId, ctx.userId);
    const frontier = existing?.highestUnlockedPosition ?? 1;

    if (step.position !== frontier) {
      // Already advanced past this step (idempotent no-op) or, defensively,
      // ahead of the frontier (unreachable — a locked step cannot be
      // passed). Either way, nothing to persist.
      return existing;
    }

    const now = new Date();
    const candidate =
      existing ??
      new SimulatorTrackProgress({
        id: input.progressId,
        trackId: step.trackId,
        academyId: ctx.orgId,
        clerkUserId: ctx.userId,
        highestUnlockedPosition: frontier,
        createdAt: now,
        updatedAt: now,
      });
    const advanced = candidate.advanceTo(frontier + 1, now);

    return this.progressRepo.upsertAdvance(ctx, advanced);
  }
}
