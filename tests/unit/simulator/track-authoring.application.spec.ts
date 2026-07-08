/**
 * Application use-case unit tests — track authoring (Phase 2,
 * gamified-simulators). All repositories are mocked with vi.fn() — no DB,
 * no infrastructure. Mirrors `simulator.application.spec.ts`'s structure and
 * fixture style.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { UnauthorizedError } from '../../../src/shared/kernel/tenant-context';
import { CreateTrackUseCase } from '../../../src/modules/simulator/application/create-track.use-case';
import { AddSimulatorToTrackStepUseCase } from '../../../src/modules/simulator/application/add-simulator-to-track-step.use-case';
import { ReorderTrackStepsUseCase } from '../../../src/modules/simulator/application/reorder-track-steps.use-case';
import { RemoveTrackStepUseCase } from '../../../src/modules/simulator/application/remove-track-step.use-case';
import { SimulatorTrack } from '../../../src/modules/simulator/domain/simulator-track.entity';
import { SimulatorTrackStep } from '../../../src/modules/simulator/domain/simulator-track-step.entity';
import { Simulator } from '../../../src/modules/simulator/domain/simulator.entity';
import {
  SimulatorTrackNotFoundError,
  SimulatorTrackStepNotFoundError,
  SimulatorAlreadyInTrackError,
  SimulatorNotFoundError,
  SimulatorNotPublishedError,
  TrackStepPositionConflictError,
  InvalidSimulatorTrackStepError,
} from '../../../src/modules/simulator/domain/errors';
import type { SimulatorTrackRepository } from '../../../src/modules/simulator/domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-step.repository';
import type { SimulatorRepository } from '../../../src/modules/simulator/domain/ports/simulator.repository';

const now = new Date('2025-01-01T00:00:00Z');

const adminCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'admin' };
const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_2', role: 'instructor' };
const learnerCtx: TenantContext = { orgId: 'org_A', userId: 'user_3', role: 'student' };

/**
 * Postgres unique-violation SQLSTATE shape — mirrors certificate use-case
 * fixtures, plus `constraint_name` (the field postgres-js actually attaches
 * to the thrown error) so tests can prove the two `simulator_track_steps`
 * unique constraints are disambiguated correctly.
 */
function uniqueViolationError(constraintName: string): Error & { code: string; constraint_name: string } {
  const err = new Error('duplicate key value violates unique constraint') as Error & {
    code: string;
    constraint_name: string;
  };
  err.code = '23505';
  err.constraint_name = constraintName;
  return err;
}

const SIMULATOR_ID_UNIQUE_CONSTRAINT = 'simulator_track_steps_simulator_id_unique';
const TRACK_ID_POSITION_UNIQUE_CONSTRAINT = 'simulator_track_steps_track_id_position_unique';

function makeTrack(overrides: Partial<ConstructorParameters<typeof SimulatorTrack>[0]> = {}): SimulatorTrack {
  return new SimulatorTrack({
    id: 'track-1',
    academyId: 'org_A',
    title: 'Ruta de matemática',
    description: null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeStep(overrides: Partial<ConstructorParameters<typeof SimulatorTrackStep>[0]> = {}): SimulatorTrackStep {
  return new SimulatorTrackStep({
    id: 'step-1',
    trackId: 'track-1',
    academyId: 'org_A',
    simulatorId: 'sim-1',
    position: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeSimulator(overrides: Partial<ConstructorParameters<typeof Simulator>[0]> = {}): Simulator {
  return new Simulator({
    id: 'sim-1',
    academyId: 'org_A',
    bankId: 'bank-1',
    title: 'Simulacro de matemática',
    description: null,
    questionCount: 3,
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

function makeTrackRepo(overrides: Partial<SimulatorTrackRepository> = {}): SimulatorTrackRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByAcademy: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeStepRepo(overrides: Partial<SimulatorTrackStepRepository> = {}): SimulatorTrackStepRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findByTrack: vi.fn().mockResolvedValue([]),
    findBySimulator: vi.fn().mockResolvedValue(null),
    countByTrack: vi.fn().mockResolvedValue(0),
    deleteById: vi.fn().mockResolvedValue(undefined),
    replacePositions: vi.fn().mockResolvedValue(undefined),
    removeAndRecompact: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeSimulatorRepo(overrides: Partial<SimulatorRepository> = {}): SimulatorRepository {
  return {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByAcademy: vi.fn(),
    findPublishedByAcademy: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// CreateTrackUseCase
// ---------------------------------------------------------------------------

describe('CreateTrackUseCase', () => {
  it('creates a draft track', async () => {
    const trackRepo = makeTrackRepo();
    const useCase = new CreateTrackUseCase(trackRepo);

    const track = await useCase.execute(adminCtx, {
      id: 'track-new',
      academyId: 'org_A',
      title: 'Ruta nueva',
    });

    expect(track.status).toBe('draft');
    expect(track.title).toBe('Ruta nueva');
    expect(trackRepo.create).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ id: 'track-new' }));
  });

  it('allows instructor to create a track', async () => {
    const trackRepo = makeTrackRepo();
    const useCase = new CreateTrackUseCase(trackRepo);

    const track = await useCase.execute(instructorCtx, {
      id: 'track-2',
      academyId: 'org_A',
      title: 'Ruta 2',
    });

    expect(track.title).toBe('Ruta 2');
  });

  it('throws UnauthorizedError when role is student', async () => {
    const trackRepo = makeTrackRepo();
    const useCase = new CreateTrackUseCase(trackRepo);

    await expect(
      useCase.execute(learnerCtx, { id: 'track-3', academyId: 'org_A', title: 'Ruta 3' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(trackRepo.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AddSimulatorToTrackStepUseCase
// ---------------------------------------------------------------------------

describe('AddSimulatorToTrackStepUseCase', () => {
  it('adds a simulator at position = countByTrack + 1', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ countByTrack: vi.fn().mockResolvedValue(1) });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator()) });
    const useCase = new AddSimulatorToTrackStepUseCase(trackRepo, stepRepo, simulatorRepo);

    const step = await useCase.execute(adminCtx, {
      id: 'step-new',
      trackId: 'track-1',
      academyId: 'org_A',
      simulatorId: 'sim-1',
    });

    expect(step.position).toBe(2);
    expect(stepRepo.create).toHaveBeenCalledWith(adminCtx, expect.objectContaining({ position: 2 }));
  });

  it('throws SimulatorTrackNotFoundError when the track does not exist', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(null) });
    const stepRepo = makeStepRepo();
    const simulatorRepo = makeSimulatorRepo();
    const useCase = new AddSimulatorToTrackStepUseCase(trackRepo, stepRepo, simulatorRepo);

    await expect(
      useCase.execute(adminCtx, { id: 'step-1', trackId: 'missing', academyId: 'org_A', simulatorId: 'sim-1' }),
    ).rejects.toThrow(SimulatorTrackNotFoundError);
    expect(stepRepo.create).not.toHaveBeenCalled();
  });

  it('throws SimulatorNotFoundError when the simulator does not exist (or cross-tenant)', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo();
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(null) });
    const useCase = new AddSimulatorToTrackStepUseCase(trackRepo, stepRepo, simulatorRepo);

    await expect(
      useCase.execute(adminCtx, { id: 'step-1', trackId: 'track-1', academyId: 'org_A', simulatorId: 'missing' }),
    ).rejects.toThrow(SimulatorNotFoundError);
    expect(stepRepo.create).not.toHaveBeenCalled();
  });

  it('throws SimulatorNotPublishedError when the simulator is a draft', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo();
    const simulatorRepo = makeSimulatorRepo({
      findById: vi.fn().mockResolvedValue(makeSimulator({ status: 'draft' })),
    });
    const useCase = new AddSimulatorToTrackStepUseCase(trackRepo, stepRepo, simulatorRepo);

    await expect(
      useCase.execute(adminCtx, { id: 'step-1', trackId: 'track-1', academyId: 'org_A', simulatorId: 'sim-1' }),
    ).rejects.toThrow(SimulatorNotPublishedError);
    expect(stepRepo.create).not.toHaveBeenCalled();
  });

  it('maps a unique-violation on the simulator_id constraint to SimulatorAlreadyInTrackError', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({
      create: vi.fn().mockRejectedValue(uniqueViolationError(SIMULATOR_ID_UNIQUE_CONSTRAINT)),
    });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator()) });
    const useCase = new AddSimulatorToTrackStepUseCase(trackRepo, stepRepo, simulatorRepo);

    await expect(
      useCase.execute(adminCtx, { id: 'step-1', trackId: 'track-1', academyId: 'org_A', simulatorId: 'sim-1' }),
    ).rejects.toThrow(SimulatorAlreadyInTrackError);
  });

  it('maps a unique-violation on the (track_id, position) constraint to a distinct TrackStepPositionConflictError, NOT SimulatorAlreadyInTrackError', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({
      create: vi.fn().mockRejectedValue(uniqueViolationError(TRACK_ID_POSITION_UNIQUE_CONSTRAINT)),
    });
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator()) });
    const useCase = new AddSimulatorToTrackStepUseCase(trackRepo, stepRepo, simulatorRepo);

    await expect(
      useCase.execute(adminCtx, { id: 'step-1', trackId: 'track-1', academyId: 'org_A', simulatorId: 'sim-1' }),
    ).rejects.toThrow(TrackStepPositionConflictError);
  });

  it('throws UnauthorizedError when role is student', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo();
    const simulatorRepo = makeSimulatorRepo({ findById: vi.fn().mockResolvedValue(makeSimulator()) });
    const useCase = new AddSimulatorToTrackStepUseCase(trackRepo, stepRepo, simulatorRepo);

    await expect(
      useCase.execute(learnerCtx, { id: 'step-1', trackId: 'track-1', academyId: 'org_A', simulatorId: 'sim-1' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(stepRepo.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ReorderTrackStepsUseCase
// ---------------------------------------------------------------------------

describe('ReorderTrackStepsUseCase', () => {
  it('swaps two steps and re-writes contiguous positions', async () => {
    const stepA = makeStep({ id: 'a', position: 1 });
    const stepB = makeStep({ id: 'b', position: 2 });
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ findByTrack: vi.fn().mockResolvedValue([stepA, stepB]) });
    const useCase = new ReorderTrackStepsUseCase(trackRepo, stepRepo);

    const reordered = await useCase.execute(adminCtx, {
      trackId: 'track-1',
      orderedStepIds: ['b', 'a'],
    });

    expect(reordered.map((s) => s.id)).toEqual(['b', 'a']);
    expect(reordered.map((s) => s.position)).toEqual([1, 2]);
    expect(stepRepo.replacePositions).toHaveBeenCalledWith(adminCtx, [
      { id: 'b', position: 1 },
      { id: 'a', position: 2 },
    ]);
  });

  it('throws SimulatorTrackNotFoundError when the track does not exist', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(null) });
    const stepRepo = makeStepRepo();
    const useCase = new ReorderTrackStepsUseCase(trackRepo, stepRepo);

    await expect(
      useCase.execute(adminCtx, { trackId: 'missing', orderedStepIds: [] }),
    ).rejects.toThrow(SimulatorTrackNotFoundError);
  });

  it('throws InvalidSimulatorTrackStepError when orderedStepIds omits an existing step', async () => {
    const stepA = makeStep({ id: 'a', position: 1 });
    const stepB = makeStep({ id: 'b', position: 2 });
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ findByTrack: vi.fn().mockResolvedValue([stepA, stepB]) });
    const useCase = new ReorderTrackStepsUseCase(trackRepo, stepRepo);

    await expect(
      useCase.execute(adminCtx, { trackId: 'track-1', orderedStepIds: ['a'] }),
    ).rejects.toThrow(InvalidSimulatorTrackStepError);
    expect(stepRepo.replacePositions).not.toHaveBeenCalled();
  });

  it('throws InvalidSimulatorTrackStepError when orderedStepIds contains a duplicate', async () => {
    const stepA = makeStep({ id: 'a', position: 1 });
    const stepB = makeStep({ id: 'b', position: 2 });
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ findByTrack: vi.fn().mockResolvedValue([stepA, stepB]) });
    const useCase = new ReorderTrackStepsUseCase(trackRepo, stepRepo);

    await expect(
      useCase.execute(adminCtx, { trackId: 'track-1', orderedStepIds: ['a', 'a'] }),
    ).rejects.toThrow(InvalidSimulatorTrackStepError);
  });

  it('throws UnauthorizedError when role is student', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ findByTrack: vi.fn().mockResolvedValue([makeStep()]) });
    const useCase = new ReorderTrackStepsUseCase(trackRepo, stepRepo);

    await expect(
      useCase.execute(learnerCtx, { trackId: 'track-1', orderedStepIds: ['step-1'] }),
    ).rejects.toThrow(UnauthorizedError);
    expect(stepRepo.replacePositions).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RemoveTrackStepUseCase
// ---------------------------------------------------------------------------

describe('RemoveTrackStepUseCase', () => {
  it('removes a step and re-compacts remaining positions contiguously', async () => {
    const stepA = makeStep({ id: 'a', position: 1 });
    const stepB = makeStep({ id: 'b', position: 2 });
    const stepC = makeStep({ id: 'c', position: 3 });
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ findByTrack: vi.fn().mockResolvedValue([stepA, stepB, stepC]) });
    const useCase = new RemoveTrackStepUseCase(trackRepo, stepRepo);

    const remaining = await useCase.execute(adminCtx, { trackId: 'track-1', stepId: 'b' });

    expect(remaining.map((s) => s.id)).toEqual(['a', 'c']);
    expect(remaining.map((s) => s.position)).toEqual([1, 2]);
    // Delete + re-compact must run as ONE atomic repository call, not two
    // separate transactions — a failure between them would otherwise leave
    // a position gap.
    expect(stepRepo.removeAndRecompact).toHaveBeenCalledWith(adminCtx, 'b', [
      { id: 'a', position: 1 },
      { id: 'c', position: 2 },
    ]);
    expect(stepRepo.deleteById).not.toHaveBeenCalled();
    expect(stepRepo.replacePositions).not.toHaveBeenCalled();
  });

  it('throws SimulatorTrackNotFoundError when the track does not exist', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(null) });
    const stepRepo = makeStepRepo();
    const useCase = new RemoveTrackStepUseCase(trackRepo, stepRepo);

    await expect(
      useCase.execute(adminCtx, { trackId: 'missing', stepId: 'a' }),
    ).rejects.toThrow(SimulatorTrackNotFoundError);
  });

  it('throws SimulatorTrackStepNotFoundError when the step is not on this track', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ findByTrack: vi.fn().mockResolvedValue([makeStep({ id: 'a' })]) });
    const useCase = new RemoveTrackStepUseCase(trackRepo, stepRepo);

    await expect(
      useCase.execute(adminCtx, { trackId: 'track-1', stepId: 'missing' }),
    ).rejects.toThrow(SimulatorTrackStepNotFoundError);
    expect(stepRepo.removeAndRecompact).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when role is student', async () => {
    const trackRepo = makeTrackRepo({ findById: vi.fn().mockResolvedValue(makeTrack()) });
    const stepRepo = makeStepRepo({ findByTrack: vi.fn().mockResolvedValue([makeStep({ id: 'a' })]) });
    const useCase = new RemoveTrackStepUseCase(trackRepo, stepRepo);

    await expect(
      useCase.execute(learnerCtx, { trackId: 'track-1', stepId: 'a' }),
    ).rejects.toThrow(UnauthorizedError);
    expect(stepRepo.removeAndRecompact).not.toHaveBeenCalled();
  });
});
