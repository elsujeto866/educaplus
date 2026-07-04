import type { TenantContext } from '@/shared/kernel/tenant-context';
import { score } from '@/shared/kernel/scoring';
import type { SimulatorAttempt } from '../domain/simulator-attempt.entity';
import { SimulatorNotFoundError } from '../domain/errors';
import type { SimulatorAttemptRepository } from '../domain/ports/simulator-attempt.repository';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/**
 * GetAttemptUseCase — the exam page's single read, implementing LAZY
 * EXPIRY (Decision 5): reading an in_progress attempt whose `deadlineAt`
 * has already passed auto-transitions it to 'expired' and scores whatever
 * `answers` exist (null/[] if the student never submitted — scores as
 * all-wrong, i.e. fail). This prevents an attempt from staying
 * perpetually 'in_progress' forever if the student simply abandons the
 * tab without ever calling SubmitAttempt.
 *
 * `attempt.clerkUserId !== ctx.userId` collapses into the SAME `null`
 * result as "does not exist" — same ownership rationale as
 * `SubmitAttemptUseCase` (RLS isolates by academy only, not by user).
 */
export class GetAttemptUseCase {
  constructor(
    private readonly attemptRepo: SimulatorAttemptRepository,
    private readonly simulatorRepo: SimulatorRepository,
  ) {}

  async execute(ctx: TenantContext, attemptId: string): Promise<SimulatorAttempt | null> {
    const attempt = await this.attemptRepo.findById(ctx, attemptId);
    if (!attempt || attempt.clerkUserId !== ctx.userId) return null;

    const isPastDeadline = Date.now() > attempt.deadlineAt.getTime();
    if (!attempt.isInProgress || !isPastDeadline) {
      return attempt;
    }

    const simulator = await this.simulatorRepo.findById(ctx, attempt.simulatorId);
    if (!simulator) throw new SimulatorNotFoundError(attempt.simulatorId);

    const answers = attempt.answers ?? [];
    const result = score(
      { id: attempt.simulatorId, questions: attempt.frozenQuestions, passingScore: simulator.passingScore },
      answers,
    );

    const expired = attempt.expire({
      answers,
      score: result.score,
      passed: result.passed,
      at: new Date(),
    });
    await this.attemptRepo.update(ctx, expired);
    return expired;
  }
}
