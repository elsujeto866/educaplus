/**
 * AdvanceProgressOnPassUseCase unit tests — fake repos (vi.fn()), no DB.
 * Mirrors `issue-simulator-certificate.use-case.spec.ts`'s structure: this
 * use-case is the EXACT progression analogue of
 * `IssueSimulatorCertificateUseCase` (lazy, idempotent, owner-only,
 * race-safe on the unique(track_id, clerk_user_id) constraint).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { AdvanceProgressOnPassUseCase } from '../../../src/modules/simulator/application/advance-progress-on-pass.use-case';
import type { AdvanceProgressOnPassInput } from '../../../src/modules/simulator/application/advance-progress-on-pass.use-case';
import { SimulatorTrackProgress } from '../../../src/modules/simulator/domain/simulator-track-progress.entity';
import { SimulatorTrackStep } from '../../../src/modules/simulator/domain/simulator-track-step.entity';
import { SimulatorAttempt } from '../../../src/modules/simulator/domain/simulator-attempt.entity';
import type { SimulatorTrackStepRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-step.repository';
import type { SimulatorTrackProgressRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-progress.repository';
import type { SimulatorAttemptRepository } from '../../../src/modules/simulator/domain/ports/simulator-attempt.repository';

const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

function makeInput(overrides: Partial<AdvanceProgressOnPassInput> = {}): AdvanceProgressOnPassInput {
  return {
    simulatorId: 'sim-2',
    progressId: 'progress-new',
    ...overrides,
  };
}

function makeStep(overrides: Partial<ConstructorParameters<typeof SimulatorTrackStep>[0]> = {}): SimulatorTrackStep {
  return new SimulatorTrackStep({
    id: 'step-2',
    trackId: 'track-1',
    academyId: 'org_A',
    simulatorId: 'sim-2',
    position: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeProgress(
  overrides: Partial<ConstructorParameters<typeof SimulatorTrackProgress>[0]> = {},
): SimulatorTrackProgress {
  return new SimulatorTrackProgress({
    id: 'progress-1',
    trackId: 'track-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    highestUnlockedPosition: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makePassedAttempt(): SimulatorAttempt {
  return new SimulatorAttempt({
    id: 'attempt-1',
    simulatorId: 'sim-2',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    status: 'submitted',
    frozenQuestions: [
      { id: 'q-1', prompt: '2+2', options: [{ id: 'a', label: '3' }, { id: 'b', label: '4' }], correctOptionId: 'b' },
    ],
    answers: [{ questionId: 'q-1', selectedOptionId: 'b' }],
    score: 90,
    passed: true,
    startedAt: now,
    deadlineAt: new Date(now.getTime() + 30 * 60_000),
    submittedAt: now,
    createdAt: now,
  });
}

describe('AdvanceProgressOnPassUseCase', () => {
  let stepRepo: SimulatorTrackStepRepository;
  let attemptRepo: SimulatorAttemptRepository;
  let progressRepo: SimulatorTrackProgressRepository;
  let useCase: AdvanceProgressOnPassUseCase;

  beforeEach(() => {
    stepRepo = {
      create: vi.fn(),
      findByTrack: vi.fn(),
      findBySimulator: vi.fn().mockResolvedValue(makeStep()),
      countByTrack: vi.fn(),
      deleteById: vi.fn(),
      replacePositions: vi.fn(),
    };
    attemptRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      startOrResume: vi.fn(),
      update: vi.fn(),
      findLatestPassed: vi.fn().mockResolvedValue(makePassedAttempt()),
    };
    progressRepo = {
      findByTrackAndUser: vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 2 })),
      upsertAdvance: vi.fn().mockImplementation((_ctx, progress) => Promise.resolve(progress)),
    };
    useCase = new AdvanceProgressOnPassUseCase(stepRepo, attemptRepo, progressRepo);
  });

  it('not-in-track: returns null and touches no repo when the simulator has no track step', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).toBeNull();
    expect(attemptRepo.findLatestPassed).not.toHaveBeenCalled();
    expect(progressRepo.upsertAdvance).not.toHaveBeenCalled();
  });

  it('no-passed-attempt: returns null and creates no row when the caller has never passed (owner-only pass-gate)', async () => {
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).toBeNull();
    expect(progressRepo.upsertAdvance).not.toHaveBeenCalled();
  });

  it('OWNER-ONLY: the pass-gate is scoped to ctx.userId, never an input-supplied user', async () => {
    await useCase.execute(learnerCtx, makeInput());

    expect(attemptRepo.findLatestPassed).toHaveBeenCalledWith(learnerCtx, 'sim-2', 'user_1');
    expect(progressRepo.findByTrackAndUser).toHaveBeenCalledWith(learnerCtx, 'track-1', 'user_1');
  });

  it('frontier-match: advances the frontier by exactly 1 and persists via a SINGLE monotonic upsertAdvance() call when a row already exists', async () => {
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 2 }));

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).not.toBeNull();
    expect(result?.highestUnlockedPosition).toBe(3);
    expect(progressRepo.upsertAdvance).toHaveBeenCalledOnce();
    const [, persisted] = (progressRepo.upsertAdvance as ReturnType<typeof vi.fn>).mock.calls[0] as [
      TenantContext,
      SimulatorTrackProgress,
    ];
    expect(persisted.highestUnlockedPosition).toBe(3);
  });

  it('frontier-match with NO existing row (implicit frontier 1, step 1): upserts the first progress row at position 2', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep({ id: 'step-1', simulatorId: 'sim-1', position: 1 }));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(learnerCtx, makeInput({ simulatorId: 'sim-1', progressId: 'progress-new' }));

    expect(result).not.toBeNull();
    expect(result?.id).toBe('progress-new');
    expect(result?.highestUnlockedPosition).toBe(2);
    expect(progressRepo.upsertAdvance).toHaveBeenCalledOnce();
  });

  it('already-passed idempotent no-op: passing step N again when N+1 is already unlocked does not advance further, no repo write', async () => {
    // Frontier is already 3 (past step 2); passing step 2 (position 2) again
    // must not double-advance the frontier or write anything.
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 3 }));

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result?.highestUnlockedPosition).toBe(3);
    expect(progressRepo.upsertAdvance).not.toHaveBeenCalled();
  });

  it('defensive no-op: a step AHEAD of the frontier (unreachable in practice) does not advance', async () => {
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 1 }));

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result?.highestUnlockedPosition).toBe(1);
    expect(progressRepo.upsertAdvance).not.toHaveBeenCalled();
  });

  it('MONOTONIC: returns whatever upsertAdvance persists, even if a concurrent write already advanced the frontier further (GREATEST wins at the DB level, not the locally computed value)', async () => {
    // A concurrent overlapping call already pushed the frontier past what
    // this call locally computed — the repo's GREATEST-based upsert is the
    // source of truth, so the use-case must return what upsertAdvance
    // resolves with, not silently trust its own locally-advanced candidate.
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 2 }));
    const persistedByConcurrentWinner = makeProgress({ highestUnlockedPosition: 5 });
    progressRepo.upsertAdvance = vi.fn().mockResolvedValue(persistedByConcurrentWinner);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).toBe(persistedByConcurrentWinner);
    expect(result?.highestUnlockedPosition).toBe(5);
  });

  it('re-throws errors from upsertAdvance', async () => {
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 2 }));
    progressRepo.upsertAdvance = vi.fn().mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(learnerCtx, makeInput())).rejects.toThrow('connection lost');
  });
});
