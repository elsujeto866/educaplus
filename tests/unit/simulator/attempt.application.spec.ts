/**
 * Application use-case unit tests — Attempt-Taking (Slice S4).
 *
 * All repositories/ports are faked with vi.fn() — no DB, no infrastructure.
 * Mirrors `simulator.application.spec.ts`'s structure and fixture style.
 * Covers the SECURITY-CRITICAL abuse cases explicitly (attempt-limit
 * exhausted, cross-user attempt access, double-submit, late-submit
 * marked expired not submitted, duplicate/foreign answer injection).
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { StartAttemptUseCase } from '../../../src/modules/simulator/application/start-attempt.use-case';
import { SubmitAttemptUseCase } from '../../../src/modules/simulator/application/submit-attempt.use-case';
import { GetAttemptUseCase } from '../../../src/modules/simulator/application/get-attempt.use-case';
import { Simulator } from '../../../src/modules/simulator/domain/simulator.entity';
import { Question } from '../../../src/modules/simulator/domain/question.entity';
import {
  SimulatorAttempt,
  type FrozenQuestion,
} from '../../../src/modules/simulator/domain/simulator-attempt.entity';
import {
  SimulatorNotFoundError,
  AttemptLimitReachedError,
  SimulatorAttemptNotFoundError,
  AttemptAlreadySubmittedError,
  InvalidAttemptAnswersError,
} from '../../../src/modules/simulator/domain/errors';
import type { SimulatorRepository } from '../../../src/modules/simulator/domain/ports/simulator.repository';
import type { QuestionRepository } from '../../../src/modules/simulator/domain/ports/question.repository';
import type { SimulatorAttemptRepository } from '../../../src/modules/simulator/domain/ports/simulator-attempt.repository';
import type { RandomPort } from '../../../src/modules/simulator/domain/ports/random.port';

const now = new Date('2025-01-01T00:00:00Z');

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const otherStudentCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'student' };

function makeSimulator(overrides: Partial<ConstructorParameters<typeof Simulator>[0]> = {}): Simulator {
  return new Simulator({
    id: 'sim-1',
    academyId: 'org_A',
    bankId: 'bank-1',
    title: 'Simulacro de matemática',
    description: null,
    questionCount: 2,
    passingScore: 70,
    timeLimitMinutes: 30,
    attemptLimit: 3,
    selectionStrategy: 'random',
    topicFilter: null,
    status: 'published',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeQuestion(overrides: Partial<ConstructorParameters<typeof Question>[0]> = {}): Question {
  return new Question({
    id: `question-${crypto.randomUUID()}`,
    bankId: 'bank-1',
    academyId: 'org_A',
    prompt: '¿Cuánto es 2+2?',
    options: [
      { id: 'opt-a', label: '3' },
      { id: 'opt-b', label: '4' },
    ],
    correctOptionId: 'opt-b',
    topic: null,
    difficulty: null,
    explanation: null,
    position: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

const frozenQuestions: FrozenQuestion[] = [
  {
    id: 'q-1',
    prompt: '2 + 2?',
    options: [
      { id: 'opt-1', label: '3' },
      { id: 'opt-2', label: '4' },
    ],
    correctOptionId: 'opt-2',
  },
  {
    id: 'q-2',
    prompt: '3 + 3?',
    options: [
      { id: 'opt-3', label: '5' },
      { id: 'opt-4', label: '6' },
    ],
    correctOptionId: 'opt-4',
  },
];

// StartAttempt/SubmitAttempt/GetAttempt compare `deadlineAt` against the
// REAL system clock (`new Date()`/`Date.now()`, never a fake timer) — so
// default attempt fixtures must be anchored to `Date.now()`, NOT the fixed
// historical `now` used for Simulator/Question fixtures above.
const attemptStartedAt = new Date();

function makeAttempt(overrides: Partial<ConstructorParameters<typeof SimulatorAttempt>[0]> = {}): SimulatorAttempt {
  return new SimulatorAttempt({
    id: 'attempt-1',
    simulatorId: 'sim-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    status: 'in_progress',
    frozenQuestions,
    answers: null,
    score: null,
    passed: null,
    startedAt: attemptStartedAt,
    deadlineAt: new Date(attemptStartedAt.getTime() + 30 * 60_000),
    submittedAt: null,
    createdAt: attemptStartedAt,
    ...overrides,
  });
}

function makeSimulatorRepo(overrides: Partial<SimulatorRepository> = {}): SimulatorRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(makeSimulator()),
    findByAcademy: vi.fn(),
    findPublishedByAcademy: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeQuestionRepo(overrides: Partial<QuestionRepository> = {}): QuestionRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByBank: vi.fn().mockResolvedValue([makeQuestion(), makeQuestion(), makeQuestion()]),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    countByBank: vi.fn().mockResolvedValue(3),
    ...overrides,
  };
}

function makeAttemptRepo(overrides: Partial<SimulatorAttemptRepository> = {}): SimulatorAttemptRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    // Default: mirrors the "no existing attempt, under the limit" path —
    // persists whatever candidate the use-case built and reports 'created'.
    startOrResume: vi
      .fn()
      .mockImplementation(async (_ctx: unknown, candidate: SimulatorAttempt) => ({
        kind: 'created' as const,
        attempt: candidate,
      })),
    update: vi.fn().mockResolvedValue(undefined),
    findLatestPassed: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeRng(sequence: number[] = [0.1, 0.2, 0.3, 0.4]): RandomPort {
  let i = 0;
  return {
    next: () => sequence[i++ % sequence.length] as number,
  };
}

// ---------------------------------------------------------------------------
// StartAttemptUseCase
// ---------------------------------------------------------------------------

describe('StartAttemptUseCase', () => {
  it('starts a new attempt within the limit: freezes N questions server-side and computes deadlineAt from timeLimitMinutes', async () => {
    const simulatorRepo = makeSimulatorRepo();
    const questionRepo = makeQuestionRepo();
    const attemptRepo = makeAttemptRepo();
    const useCase = new StartAttemptUseCase(simulatorRepo, questionRepo, attemptRepo, makeRng());

    const result = await useCase.execute(studentCtx, { id: 'new-attempt', simulatorId: 'sim-1' });

    expect(result.status).toBe('in_progress');
    expect(result.frozenQuestions).toHaveLength(2);
    // Snapshot carries correctOptionId (server-side trust) — the client-strip
    // happens in the view-model mapper, NOT here.
    expect(result.frozenQuestions[0]?.correctOptionId).toBeTruthy();
    expect(result.deadlineAt.getTime() - result.startedAt.getTime()).toBe(30 * 60_000);
    // SECURITY: the resume-check + limit-count + insert are ONE atomic call
    // — never a separate create() (see startOrResume's docstring, WARNING-1
    // fix). attemptRepo.create exists on the port for other callers but is
    // never invoked from this use-case.
    expect(attemptRepo.startOrResume).toHaveBeenCalledTimes(1);
    expect(attemptRepo.startOrResume).toHaveBeenCalledWith(
      studentCtx,
      expect.objectContaining({ id: 'new-attempt' }),
      3, // simulator.attemptLimit
    );
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });

  it('rejects starting a new attempt when the attempt limit is already reached (SERVER-SIDE, before any row is created)', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator({ attemptLimit: 3 })) });
    const questionRepo = makeQuestionRepo();
    const attemptRepo = makeAttemptRepo({
      startOrResume: vi.fn().mockResolvedValue({ kind: 'limit_reached' }),
    });
    const useCase = new StartAttemptUseCase(simulatorRepo, questionRepo, attemptRepo, makeRng());

    await expect(
      useCase.execute(studentCtx, { id: 'new-attempt', simulatorId: 'sim-1' }),
    ).rejects.toThrow(AttemptLimitReachedError);
    expect(attemptRepo.create).not.toHaveBeenCalled();
  });

  it('rejects starting an attempt on a nonexistent/cross-tenant simulator', async () => {
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(null) });
    const questionRepo = makeQuestionRepo();
    const attemptRepo = makeAttemptRepo();
    const useCase = new StartAttemptUseCase(simulatorRepo, questionRepo, attemptRepo, makeRng());

    await expect(
      useCase.execute(studentCtx, { id: 'new-attempt', simulatorId: 'ghost' }),
    ).rejects.toThrow(SimulatorNotFoundError);
    expect(attemptRepo.startOrResume).not.toHaveBeenCalled();
  });

  it('rejects starting an attempt on an UNPUBLISHED (draft) simulator — collapsed into the same not-found error', async () => {
    const simulatorRepo = makeSimulatorRepo({
      findById: vi.fn().mockResolvedValue(makeSimulator({ status: 'draft' })),
    });
    const questionRepo = makeQuestionRepo();
    const attemptRepo = makeAttemptRepo();
    const useCase = new StartAttemptUseCase(simulatorRepo, questionRepo, attemptRepo, makeRng());

    await expect(
      useCase.execute(studentCtx, { id: 'new-attempt', simulatorId: 'sim-1' }),
    ).rejects.toThrow(SimulatorNotFoundError);
  });

  it('resumes an existing in_progress attempt instead of creating a new row (no timer reset)', async () => {
    const existing = makeAttempt();
    const simulatorRepo = makeSimulatorRepo();
    const questionRepo = makeQuestionRepo();
    const attemptRepo = makeAttemptRepo({
      startOrResume: vi.fn().mockResolvedValue({ kind: 'resumed', attempt: existing }),
    });
    const useCase = new StartAttemptUseCase(simulatorRepo, questionRepo, attemptRepo, makeRng());

    const result = await useCase.execute(studentCtx, { id: 'new-attempt', simulatorId: 'sim-1' });

    expect(result).toBe(existing);
    expect(attemptRepo.create).not.toHaveBeenCalled();
    expect(attemptRepo.startOrResume).toHaveBeenCalledTimes(1);
  });

  it('SECURITY (WARNING-1 fix, CWE-367) — the resume-check + attempt-limit gate + insert are routed through the SINGLE atomic startOrResume call; the port exposes no separate count-then-create path a caller could accidentally split across transactions', async () => {
    const simulatorRepo = makeSimulatorRepo();
    const questionRepo = makeQuestionRepo();
    const attemptRepo = makeAttemptRepo();
    const useCase = new StartAttemptUseCase(simulatorRepo, questionRepo, attemptRepo, makeRng());

    await useCase.execute(studentCtx, { id: 'new-attempt', simulatorId: 'sim-1' });

    // The ONLY way this use-case can create/resume/reject a start is through
    // startOrResume — there is no findInProgress/countByUserAndSimulator on
    // the port anymore, so a non-atomic count-then-create sequence is not
    // even expressible in this use-case (structurally enforced by the type,
    // not just by convention).
    expect(attemptRepo.startOrResume).toHaveBeenCalledTimes(1);
    expect(
      (attemptRepo as unknown as Record<string, unknown>)['findInProgress'],
    ).toBeUndefined();
    expect(
      (attemptRepo as unknown as Record<string, unknown>)['countByUserAndSimulator'],
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SubmitAttemptUseCase
// ---------------------------------------------------------------------------

describe('SubmitAttemptUseCase', () => {
  it('scores a submission arriving BEFORE the deadline as status "submitted"', async () => {
    const attempt = makeAttempt();
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    const result = await useCase.execute(studentCtx, {
      attemptId: 'attempt-1',
      answers: [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
      ],
    });

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.status).toBe('submitted');
    expect(attemptRepo.update).toHaveBeenCalledTimes(1);
    const persisted = (attemptRepo.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as SimulatorAttempt;
    expect(persisted.status).toBe('submitted');
  });

  it('ABUSE CASE — a submission arriving AFTER deadlineAt is NEVER rejected, but is scored and marked "expired" (never "submitted")', async () => {
    const attempt = makeAttempt({
      startedAt: new Date(Date.now() - 60 * 60_000), // started 60 min ago
      deadlineAt: new Date(Date.now() - 30 * 60_000), // deadline 30 min ago — already passed
    });
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    const result = await useCase.execute(studentCtx, {
      attemptId: 'attempt-1',
      answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
    });

    // Never rejected — the student does not lose the attempt.
    expect(result.status).toBe('expired');
    expect(result.score).toBe(50); // 1 of 2 correct
  });

  it('ABUSE CASE — rejects a resubmission of an already-finished attempt (single-submission)', async () => {
    const finished = makeAttempt({
      status: 'submitted',
      score: 100,
      passed: true,
      submittedAt: new Date(),
    });
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(finished) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    await expect(
      useCase.execute(studentCtx, {
        attemptId: 'attempt-1',
        answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
      }),
    ).rejects.toThrow(AttemptAlreadySubmittedError);
    expect(attemptRepo.update).not.toHaveBeenCalled();
  });

  it('ABUSE CASE — rejects a nonexistent/cross-tenant attempt id', async () => {
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(null) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    await expect(
      useCase.execute(studentCtx, { attemptId: 'ghost', answers: [] }),
    ).rejects.toThrow(SimulatorAttemptNotFoundError);
  });

  it('ABUSE CASE — rejects access to another student\'s attempt within the SAME academy (RLS only isolates by academy, not by user)', async () => {
    const attempt = makeAttempt({ clerkUserId: 'user_1' });
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    await expect(
      useCase.execute(otherStudentCtx, {
        attemptId: 'attempt-1',
        answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
      }),
    ).rejects.toThrow(SimulatorAttemptNotFoundError);
  });

  it('ABUSE CASE — rejects an answer whose questionId does not belong to this attempt\'s frozen snapshot', async () => {
    const attempt = makeAttempt();
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    await expect(
      useCase.execute(studentCtx, {
        attemptId: 'attempt-1',
        answers: [{ questionId: 'foreign-question', selectedOptionId: 'opt-2' }],
      }),
    ).rejects.toThrow(InvalidAttemptAnswersError);
  });

  it('ABUSE CASE — rejects duplicate answers for the same question (blocks inflating the score by repeating the correct one)', async () => {
    const attempt = makeAttempt();
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    await expect(
      useCase.execute(studentCtx, {
        attemptId: 'attempt-1',
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-2' },
          { questionId: 'q-1', selectedOptionId: 'opt-2' },
        ],
      }),
    ).rejects.toThrow(InvalidAttemptAnswersError);
  });

  it('accepts a PARTIAL submission (fewer answers than questions) — unanswered questions count as wrong, never rejected', async () => {
    const attempt = makeAttempt();
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new SubmitAttemptUseCase(attemptRepo, simulatorRepo);

    const result = await useCase.execute(studentCtx, {
      attemptId: 'attempt-1',
      answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
    });

    expect(result.score).toBe(50);
    expect(result.status).toBe('submitted');
  });
});

// ---------------------------------------------------------------------------
// GetAttemptUseCase — lazy expiry
// ---------------------------------------------------------------------------

describe('GetAttemptUseCase', () => {
  it('returns an in_progress attempt unchanged when the deadline has not passed', async () => {
    const attempt = makeAttempt({ deadlineAt: new Date(Date.now() + 60_000) });
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new GetAttemptUseCase(attemptRepo, simulatorRepo);

    const result = await useCase.execute(studentCtx, 'attempt-1');

    expect(result?.status).toBe('in_progress');
    expect(attemptRepo.update).not.toHaveBeenCalled();
  });

  it('LAZY EXPIRY — reading an in_progress attempt PAST its deadline auto-transitions it to expired and scores present answers (none = fail)', async () => {
    const attempt = makeAttempt({
      startedAt: new Date(Date.now() - 120_000),
      deadlineAt: new Date(Date.now() - 60_000),
    });
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new GetAttemptUseCase(attemptRepo, simulatorRepo);

    const result = await useCase.execute(studentCtx, 'attempt-1');

    expect(result?.status).toBe('expired');
    expect(result?.score).toBe(0);
    expect(result?.passed).toBe(false);
    expect(attemptRepo.update).toHaveBeenCalledTimes(1);
  });

  it('returns null for a nonexistent/cross-tenant/cross-user attempt (never leaks existence)', async () => {
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(null) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new GetAttemptUseCase(attemptRepo, simulatorRepo);

    expect(await useCase.execute(studentCtx, 'ghost')).toBeNull();
  });

  it("ABUSE CASE — returns null for another student's attempt within the SAME academy", async () => {
    const attempt = makeAttempt({ clerkUserId: 'user_1' });
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new GetAttemptUseCase(attemptRepo, simulatorRepo);

    expect(await useCase.execute(otherStudentCtx, 'attempt-1')).toBeNull();
  });

  it('returns a finished (submitted) attempt unchanged, without re-scoring', async () => {
    const attempt = makeAttempt({
      status: 'submitted',
      answers: [{ questionId: 'q-1', selectedOptionId: 'opt-2' }],
      score: 50,
      passed: false,
      submittedAt: new Date(),
    });
    const attemptRepo = makeAttemptRepo({ findById: vi.fn().mockResolvedValue(attempt) });
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new GetAttemptUseCase(attemptRepo, simulatorRepo);

    const result = await useCase.execute(studentCtx, 'attempt-1');

    expect(result).toBe(attempt);
    expect(attemptRepo.update).not.toHaveBeenCalled();
  });
});
