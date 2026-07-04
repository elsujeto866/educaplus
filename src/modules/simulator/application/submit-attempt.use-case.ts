import type { TenantContext } from '@/shared/kernel/tenant-context';
import { score } from '@/shared/kernel/scoring';
import type { SimulatorAttempt, SubmittedAnswer } from '../domain/simulator-attempt.entity';
import {
  SimulatorNotFoundError,
  SimulatorAttemptNotFoundError,
  AttemptAlreadySubmittedError,
} from '../domain/errors';
import { assertPartialAnswersValid } from '../domain/services/attempt-answers.service';
import type { SimulatorAttemptRepository } from '../domain/ports/simulator-attempt.repository';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

export interface SubmitAttemptInput {
  attemptId: string;
  answers: SubmittedAnswer[];
}

export interface SubmitAttemptResult {
  score: number;
  passed: boolean;
  status: 'submitted' | 'expired';
}

/**
 * SubmitAttemptUseCase
 *
 * SECURITY-CRITICAL ordering:
 *   1. Load the attempt. `attempt.clerkUserId !== ctx.userId` is collapsed
 *      into the SAME `SimulatorAttemptNotFoundError` as "does not exist" —
 *      RLS only isolates by academy_id, NOT by clerkUserId, so this
 *      ownership check is LOAD-BEARING, not defensive: without it, any
 *      authenticated member of the SAME academy could submit answers for
 *      another student's attempt by guessing its UUID.
 *   2. Reject if the attempt is no longer 'in_progress' — enforces
 *      single-submission (abuse case: double-submit).
 *   3. Validate answers against the attempt's OWN frozen snapshot
 *      (`assertPartialAnswersValid` — partial is allowed, duplicates and
 *      foreign question/option ids are not).
 *   4. Score via `shared/kernel/scoring.score()` against the simulator's
 *      `passingScore`.
 *   5. SERVER-AUTHORITATIVE deadline check: `now` (server clock) vs
 *      `attempt.deadlineAt` (server-issued at StartAttempt) — a client can
 *      never influence this comparison. Late is NEVER rejected (Decision
 *      5 — the student must not lose the attempt) but is persisted as
 *      'expired', not 'submitted': late != on-time.
 */
export class SubmitAttemptUseCase {
  constructor(
    private readonly attemptRepo: SimulatorAttemptRepository,
    private readonly simulatorRepo: SimulatorRepository,
  ) {}

  async execute(ctx: TenantContext, input: SubmitAttemptInput): Promise<SubmitAttemptResult> {
    const attempt = await this.attemptRepo.findById(ctx, input.attemptId);
    if (!attempt || attempt.clerkUserId !== ctx.userId) {
      throw new SimulatorAttemptNotFoundError(input.attemptId);
    }

    if (!attempt.isInProgress) {
      throw new AttemptAlreadySubmittedError(input.attemptId);
    }

    assertPartialAnswersValid(attempt.frozenQuestions, input.answers);

    const simulator = await this.simulatorRepo.findById(ctx, attempt.simulatorId);
    if (!simulator) throw new SimulatorNotFoundError(attempt.simulatorId);

    const result = score(
      { id: attempt.simulatorId, questions: attempt.frozenQuestions, passingScore: simulator.passingScore },
      input.answers,
    );

    const now = new Date();
    const isLate = now.getTime() > attempt.deadlineAt.getTime();
    const updated: SimulatorAttempt = isLate
      ? attempt.expire({ answers: input.answers, score: result.score, passed: result.passed, at: now })
      : attempt.submit({ answers: input.answers, score: result.score, passed: result.passed, at: now });

    await this.attemptRepo.update(ctx, updated);

    return { score: result.score, passed: result.passed, status: updated.status as 'submitted' | 'expired' };
  }
}
