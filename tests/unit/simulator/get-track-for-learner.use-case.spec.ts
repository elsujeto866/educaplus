/**
 * GetTrackForLearnerUseCase unit tests — fake repos (vi.fn()), no DB.
 *
 * Covers the "lazy-on-view" self-heal seam (design.md "Progression triggered
 * lazily on track-map view"): every call reconciles the frontier against the
 * learner's attempt history for the CURRENT frontier step via
 * `AdvanceProgressOnPassUseCase` before deriving each step's
 * locked/unlocked/passed status — this is the mechanism that avoids ever
 * editing `SubmitAttemptUseCase`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetTrackForLearnerUseCase } from '../../../src/modules/simulator/application/get-track-for-learner.use-case';
import type { GetTrackForLearnerInput } from '../../../src/modules/simulator/application/get-track-for-learner.use-case';
import { AdvanceProgressOnPassUseCase } from '../../../src/modules/simulator/application/advance-progress-on-pass.use-case';
import { SimulatorTrack } from '../../../src/modules/simulator/domain/simulator-track.entity';
import { SimulatorTrackStep } from '../../../src/modules/simulator/domain/simulator-track-step.entity';
import { SimulatorTrackProgress } from '../../../src/modules/simulator/domain/simulator-track-progress.entity';
import { SimulatorTrackNotFoundError } from '../../../src/modules/simulator/domain/errors';
import type { SimulatorTrackRepository } from '../../../src/modules/simulator/domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-step.repository';
import type { SimulatorTrackProgressRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-progress.repository';

const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

function makeInput(overrides: Partial<GetTrackForLearnerInput> = {}): GetTrackForLearnerInput {
  return {
    trackId: 'track-1',
    progressId: 'progress-new',
    ...overrides,
  };
}

function makeTrack(): SimulatorTrack {
  return new SimulatorTrack({
    id: 'track-1',
    academyId: 'org_A',
    title: 'Ruta de matemática',
    description: null,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  });
}

function makeStep(position: number, simulatorId: string): SimulatorTrackStep {
  return new SimulatorTrackStep({
    id: `step-${position}`,
    trackId: 'track-1',
    academyId: 'org_A',
    simulatorId,
    position,
    createdAt: now,
    updatedAt: now,
  });
}

const threeSteps = [makeStep(1, 'sim-1'), makeStep(2, 'sim-2'), makeStep(3, 'sim-3')];

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

describe('GetTrackForLearnerUseCase', () => {
  let trackRepo: SimulatorTrackRepository;
  let stepRepo: SimulatorTrackStepRepository;
  let progressRepo: SimulatorTrackProgressRepository;
  let advanceProgressOnPass: AdvanceProgressOnPassUseCase;
  let useCase: GetTrackForLearnerUseCase;

  beforeEach(() => {
    trackRepo = {
      create: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeTrack()),
      findByAcademy: vi.fn(),
      update: vi.fn(),
    };
    stepRepo = {
      create: vi.fn(),
      findByTrack: vi.fn().mockResolvedValue(threeSteps),
      findBySimulator: vi.fn(),
      countByTrack: vi.fn(),
      deleteById: vi.fn(),
      replacePositions: vi.fn(),
      removeAndRecompact: vi.fn(),
    };
    progressRepo = {
      findByTrackAndUser: vi.fn().mockResolvedValue(null),
      upsertAdvance: vi.fn().mockImplementation((_ctx, progress) => Promise.resolve(progress)),
    };
    // Real AdvanceProgressOnPassUseCase wired to the SAME fake repos — this
    // exercises the actual reconciliation seam, not a mock of it.
    advanceProgressOnPass = new AdvanceProgressOnPassUseCase(
      stepRepo,
      { create: vi.fn(), findById: vi.fn(), startOrResume: vi.fn(), update: vi.fn(), findLatestPassed: vi.fn().mockResolvedValue(null) },
      progressRepo,
    );
    useCase = new GetTrackForLearnerUseCase(trackRepo, stepRepo, progressRepo, advanceProgressOnPass);
  });

  it('throws SimulatorTrackNotFoundError when the track does not exist (or is not this academy\'s)', async () => {
    trackRepo.findById = vi.fn().mockResolvedValue(null);

    await expect(useCase.execute(learnerCtx, makeInput())).rejects.toThrow(SimulatorTrackNotFoundError);
  });

  it('step 1 open by default: with no progress row, step 1 is unlocked and the rest are locked', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(threeSteps[0]);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result.steps).toEqual([
      { stepId: 'step-1', simulatorId: 'sim-1', position: 1, status: 'unlocked' },
      { stepId: 'step-2', simulatorId: 'sim-2', position: 2, status: 'locked' },
      { stepId: 'step-3', simulatorId: 'sim-3', position: 3, status: 'locked' },
    ]);
  });

  it('mixed status rendering: passed step 1, unlocked step 2, locked step 3 (spec.md "Mixed status rendering")', async () => {
    progressRepo.findByTrackAndUser = vi.fn().mockResolvedValue(makeProgress(2));
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(threeSteps[1]);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result.steps).toEqual([
      { stepId: 'step-1', simulatorId: 'sim-1', position: 1, status: 'passed' },
      { stepId: 'step-2', simulatorId: 'sim-2', position: 2, status: 'unlocked' },
      { stepId: 'step-3', simulatorId: 'sim-3', position: 3, status: 'locked' },
    ]);
  });

  it('self-heals lazily: a passing attempt on the frontier step advances the frontier BEFORE deriving status', async () => {
    // No progress row yet (implicit frontier 1). The learner already has a
    // passing attempt for step 1's simulator, which this call must surface
    // as an unlock of step 2 WITHOUT any separate call to
    // AdvanceProgressOnPassUseCase or an edit to SubmitAttemptUseCase.
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(threeSteps[0]);
    const attemptRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      startOrResume: vi.fn(),
      update: vi.fn(),
      findLatestPassed: vi.fn().mockResolvedValue({ id: 'attempt-1', score: 90 }),
    };
    advanceProgressOnPass = new AdvanceProgressOnPassUseCase(stepRepo, attemptRepo, progressRepo);
    useCase = new GetTrackForLearnerUseCase(trackRepo, stepRepo, progressRepo, advanceProgressOnPass);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result.steps).toEqual([
      { stepId: 'step-1', simulatorId: 'sim-1', position: 1, status: 'passed' },
      { stepId: 'step-2', simulatorId: 'sim-2', position: 2, status: 'unlocked' },
      { stepId: 'step-3', simulatorId: 'sim-3', position: 3, status: 'locked' },
    ]);
    expect(progressRepo.upsertAdvance).toHaveBeenCalledOnce();
  });

  it('returns the track entity alongside the step views', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(threeSteps[0]);

    const result = await useCase.execute(learnerCtx, makeInput());

    expect(result.track).toBeInstanceOf(SimulatorTrack);
    expect(result.track.id).toBe('track-1');
  });
});
