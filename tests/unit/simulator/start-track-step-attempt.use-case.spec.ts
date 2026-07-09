/**
 * StartTrackStepAttemptUseCase unit tests — fake repos + a fake
 * `StartAttemptUseCase` (vi.fn()), no DB.
 *
 * THE locked-step gate (Phase 6, spec.md "Reject attempt on locked step"):
 * composes AROUND the shipped `StartAttemptUseCase` — never edits it.
 * Checks lock status via `SimulatorTrackStepRepository.findBySimulator` +
 * `SimulatorTrackProgressRepository.findByTrackAndUser` (the SAME frontier
 * derivation `GetTrackForLearnerUseCase` uses), then either throws
 * `StepLockedError` BEFORE ever calling `startAttempt.execute`, or
 * delegates straight through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { StartTrackStepAttemptUseCase } from '../../../src/modules/simulator/application/start-track-step-attempt.use-case';
import type {
  StartTrackStepAttemptInput,
  AttemptStarter,
} from '../../../src/modules/simulator/application/start-track-step-attempt.use-case';
import { StepLockedError } from '../../../src/modules/simulator/domain/errors';
import { SimulatorTrackStep } from '../../../src/modules/simulator/domain/simulator-track-step.entity';
import { SimulatorTrackProgress } from '../../../src/modules/simulator/domain/simulator-track-progress.entity';
import type { SimulatorTrackStepRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-step.repository';
import type { SimulatorTrackProgressRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-progress.repository';

const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

function makeInput(overrides: Partial<StartTrackStepAttemptInput> = {}): StartTrackStepAttemptInput {
  return {
    id: 'attempt-new',
    simulatorId: 'sim-2',
    ...overrides,
  };
}

function makeStep(position: number, simulatorId = 'sim-2'): SimulatorTrackStep {
  return new SimulatorTrackStep({
    id: 'step-2',
    trackId: 'track-1',
    academyId: 'org_A',
    simulatorId,
    position,
    createdAt: now,
    updatedAt: now,
  });
}

function makeProgress(highestUnlockedPosition: number): SimulatorTrackProgress {
  return new SimulatorTrackProgress({
    id: 'progress-1',
    trackId: 'track-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    highestUnlockedPosition,
    createdAt: now,
    updatedAt: now,
  });
}

describe('StartTrackStepAttemptUseCase', () => {
  let stepRepo: SimulatorTrackStepRepository;
  let progressRepo: SimulatorTrackProgressRepository;
  let startAttempt: AttemptStarter;
  let useCase: StartTrackStepAttemptUseCase;

  beforeEach(() => {
    stepRepo = {
      create: vi.fn(),
      findByTrack: vi.fn(),
      findBySimulator: vi.fn().mockResolvedValue(null),
      countByTrack: vi.fn(),
      deleteById: vi.fn(),
      replacePositions: vi.fn(),
      removeAndRecompact: vi.fn(),
    };
    progressRepo = {
      findByTrackAndUser: vi.fn().mockResolvedValue(null),
      upsertAdvance: vi.fn(),
    };
    startAttempt = {
      execute: vi.fn().mockResolvedValue({ id: 'attempt-1', simulatorId: 'sim-2' }),
    };
    useCase = new StartTrackStepAttemptUseCase(stepRepo, progressRepo, startAttempt);
  });

  it('delegates straight through when the simulator is NOT a track step (standalone simulator)', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).toEqual({ id: 'attempt-1', simulatorId: 'sim-2' });
    expect(progressRepo.findByTrackAndUser).not.toHaveBeenCalled();
    expect(startAttempt.execute).toHaveBeenCalledWith(learnerCtx, { id: 'attempt-new', simulatorId: 'sim-2' });
  });

  it('ALLOWS starting the frontier (currently unlocked) step', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep(2));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress(2));

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result).toEqual({ id: 'attempt-1', simulatorId: 'sim-2' });
    expect(startAttempt.execute).toHaveBeenCalledOnce();
  });

  it('ALLOWS re-taking an already-PASSED step (position < frontier)', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep(1));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress(3));

    await useCase.execute(learnerCtx, makeInput({ simulatorId: 'sim-2' }));

    expect(startAttempt.execute).toHaveBeenCalledOnce();
  });

  it('step 1 open by default: with NO progress row, the implicit frontier is 1', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep(1));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(null);

    await useCase.execute(learnerCtx, makeInput());

    expect(startAttempt.execute).toHaveBeenCalledOnce();
  });

  it('REJECTS a LOCKED step (position > frontier) with StepLockedError, NEVER calling startAttempt.execute', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep(3));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress(2));

    await expect(useCase.execute(learnerCtx, makeInput())).rejects.toThrow(StepLockedError);
    expect(startAttempt.execute).not.toHaveBeenCalled();
  });

  it('REJECTS a locked step 2 when NO progress row exists yet (implicit frontier 1)', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep(2));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute(learnerCtx, makeInput())).rejects.toThrow(StepLockedError);
    expect(startAttempt.execute).not.toHaveBeenCalled();
  });

  it('OWNER-ONLY: the progress lookup is scoped to ctx.userId, never an input-supplied user', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(makeStep(2));
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress(2));

    await useCase.execute(learnerCtx, makeInput());

    expect(progressRepo.findByTrackAndUser).toHaveBeenCalledWith(learnerCtx, 'track-1', 'user_1');
  });
});
