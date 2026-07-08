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
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new AdvanceProgressOnPassUseCase(stepRepo, attemptRepo, progressRepo);
  });

  it('not-in-track: returns null and touches no repo when the simulator has no track step', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).toBeNull();
    expect(attemptRepo.findLatestPassed).not.toHaveBeenCalled();
    expect(progressRepo.create).not.toHaveBeenCalled();
    expect(progressRepo.update).not.toHaveBeenCalled();
  });

  it('no-passed-attempt: returns null and creates no row when the caller has never passed (owner-only pass-gate)', async () => {
    attemptRepo.findLatestPassed = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).toBeNull();
    expect(progressRepo.create).not.toHaveBeenCalled();
    expect(progressRepo.update).not.toHaveBeenCalled();
  });

  it('OWNER-ONLY: the pass-gate is scoped to ctx.userId, never an input-supplied user', async () => {
    await useCase.execute(learnerCtx, makeInput());

    expect(attemptRepo.findLatestPassed).toHaveBeenCalledWith(learnerCtx, 'sim-2', 'user_1');
    expect(progressRepo.findByTrackAndUser).toHaveBeenCalledWith(learnerCtx, 'track-1', 'user_1');
  });

  it('frontier-match: advances the frontier by exactly 1 and persists via update() when a row already exists', async () => {
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 2 }));

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).not.toBeNull();
    expect(result?.highestUnlockedPosition).toBe(3);
    expect(progressRepo.update).toHaveBeenCalledOnce();
    expect(progressRepo.create).not.toHaveBeenCalled();
  });

  it('frontier-match with NO existing row (implicit frontier 1, step 1): creates the first progress row at position 2', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep({ id: 'step-1', simulatorId: 'sim-1', position: 1 }));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(learnerCtx, makeInput({ simulatorId: 'sim-1', progressId: 'progress-new' }));

    expect(result).not.toBeNull();
    expect(result?.id).toBe('progress-new');
    expect(result?.highestUnlockedPosition).toBe(2);
    expect(progressRepo.create).toHaveBeenCalledOnce();
    expect(progressRepo.update).not.toHaveBeenCalled();
  });

  it('already-passed idempotent no-op: passing step N again when N+1 is already unlocked does not advance further, no repo write', async () => {
    // Frontier is already 3 (past step 2); passing step 2 (position 2) again
    // must not double-advance the frontier or write anything.
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 3 }));

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result?.highestUnlockedPosition).toBe(3);
    expect(progressRepo.create).not.toHaveBeenCalled();
    expect(progressRepo.update).not.toHaveBeenCalled();
  });

  it('defensive no-op: a step AHEAD of the frontier (unreachable in practice) does not advance', async () => {
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 1 }));

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result?.highestUnlockedPosition).toBe(1);
    expect(progressRepo.create).not.toHaveBeenCalled();
    expect(progressRepo.update).not.toHaveBeenCalled();
  });

  it('race: a unique-violation (23505) on create re-reads and returns the winning row instead of surfacing the DB error', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep({ id: 'step-1', simulatorId: 'sim-1', position: 1 }));
    const raced = makeProgress({ id: 'progress-raced', highestUnlockedPosition: 2 });
    let callCount = 0;
    progressRepo.findByTrackAndUser = vi.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(callCount === 1 ? null : raced);
    });
    progressRepo.create = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('duplicate key value'), { code: '23505' }));

    const result = await useCase.execute(learnerCtx, makeInput({ simulatorId: 'sim-1' }));

    expect(result).toBe(raced);
    expect(progressRepo.findByTrackAndUser).toHaveBeenCalledTimes(2);
  });

  it('re-throws non-unique-violation errors from create', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep({ id: 'step-1', simulatorId: 'sim-1', position: 1 }));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(null);
    progressRepo.create = vi.fn().mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(learnerCtx, makeInput({ simulatorId: 'sim-1' }))).rejects.toThrow(
      'connection lost',
    );
  });

  it('re-throws non-unique-violation errors from update', async () => {
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress({ highestUnlockedPosition: 2 }));
    progressRepo.update = vi.fn().mockRejectedValue(new Error('connection lost'));

    await expect(useCase.execute(learnerCtx, makeInput())).rejects.toThrow('connection lost');
  });
});
