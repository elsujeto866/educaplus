import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorAttempt } from '../domain/simulator-attempt.entity';
import { SimulatorNotFoundError, AttemptLimitReachedError } from '../domain/errors';
import { selectQuestions } from '../domain/services/question-selection.service';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';
import type { QuestionRepository } from '../domain/ports/question.repository';
import type { SimulatorAttemptRepository } from '../domain/ports/simulator-attempt.repository';
import type { RandomPort } from '../domain/ports/random.port';

export interface StartAttemptInput {
  /** Caller-supplied UUID for a NEW attempt row — ignored when resuming. */
  id: string;
  simulatorId: string;
}

/**
 * StartAttemptUseCase
 *
 * Order of operations is deliberate and SECURITY-CRITICAL:
 *   1. Resolve simulator — not-found/cross-tenant/draft all collapse into
 *      ONE `SimulatorNotFoundError` (mirrors `GetPublishedSimulatorUseCase`
 *      — a draft simulator's existence never leaks to a guessing student).
 *   2. Draw + freeze the question set via the selection engine, using a
 *      SERVER start timestamp for both `startedAt` and the computed
 *      `deadlineAt` (never trust a client-supplied clock). Built as a
 *      CANDIDATE attempt — it may be discarded below (resume/limit-reached)
 *      without ever touching the DB; the wasted local computation is a
 *      deliberate tradeoff for atomicity (see step 3).
 *   3. `attemptRepo.startOrResume` — resume-check + attempt-limit gate +
 *      insert run as ONE ATOMIC, lock-serialized operation in the
 *      infrastructure layer (SECURITY FIX, CWE-367 TOCTOU: the previous
 *      version called `findInProgress` + `countByUserAndSimulator` +
 *      `create` as THREE separate transactions, letting concurrent starts
 *      each pass the count check before any had inserted — see
 *      `SimulatorAttemptRepository.startOrResume` docstring). This
 *      use-case only interprets the outcome:
 *        - 'resumed'      → the existing in_progress attempt, AS-IS (same
 *                           frozenQuestions + same deadlineAt — Decision 5,
 *                           no timer reset, no parallel attempts).
 *        - 'limit_reached' → reject the START itself (spec.md "Attempt
 *                           limit exhausted"), not just hidden in the UI.
 *        - 'created'      → the freshly persisted candidate.
 *
 * No `assertRole` guard — students self-attempt; "published + under limit"
 * IS the gate (mirrors course's `SubmitAttemptUseCase` enrollment gate).
 */
export class StartAttemptUseCase {
  constructor(
    private readonly simulatorRepo: SimulatorRepository,
    private readonly questionRepo: QuestionRepository,
    private readonly attemptRepo: SimulatorAttemptRepository,
    private readonly rng: RandomPort,
  ) {}

  async execute(ctx: TenantContext, input: StartAttemptInput): Promise<SimulatorAttempt> {
    const simulator = await this.simulatorRepo.findById(ctx, input.simulatorId);
    if (!simulator || !simulator.isPublished) {
      throw new SimulatorNotFoundError(input.simulatorId);
    }

    const pool = await this.questionRepo.findByBank(ctx, simulator.bankId);
    const selected = selectQuestions(pool, simulator.questionCount, simulator.topicFilter, this.rng);

    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + simulator.timeLimitMinutes * 60_000);

    const candidate = new SimulatorAttempt({
      id: input.id,
      simulatorId: simulator.id,
      academyId: ctx.orgId,
      clerkUserId: ctx.userId,
      status: 'in_progress',
      frozenQuestions: selected.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        correctOptionId: q.correctOptionId,
      })),
      answers: null,
      score: null,
      passed: null,
      startedAt,
      deadlineAt,
      submittedAt: null,
      createdAt: startedAt,
    });

    const result = await this.attemptRepo.startOrResume(ctx, candidate, simulator.attemptLimit);
    if (result.kind === 'limit_reached') {
      throw new AttemptLimitReachedError(simulator.id, simulator.attemptLimit);
    }
    return result.attempt;
  }
}
