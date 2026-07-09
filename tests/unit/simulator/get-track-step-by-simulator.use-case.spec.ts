/**
 * GetTrackStepBySimulatorUseCase unit tests — fake repo (vi.fn()), no DB.
 *
 * Thin read pass-through, added in Phase 6 SOLELY so delivery (which may
 * only import `composition`, never `domain`/`infrastructure` directly —
 * eslint-boundaries) can ask "is this simulator a track step?" without a
 * new repository method. Backs the standalone-catalog/detail bypass fix:
 * `learn/simulators/page.tsx` and `[simulatorId]/page.tsx` use this to hide
 * any simulator that belongs to a track, forcing the gated track level-map
 * flow instead.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { GetTrackStepBySimulatorUseCase } from '../../../src/modules/simulator/application/get-track-step-by-simulator.use-case';
import { SimulatorTrackStep } from '../../../src/modules/simulator/domain/simulator-track-step.entity';
import type { SimulatorTrackStepRepository } from '../../../src/modules/simulator/domain/ports/simulator-track-step.repository';

const ctx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };
const now = new Date('2025-01-01T00:00:00Z');

describe('GetTrackStepBySimulatorUseCase', () => {
  let stepRepo: SimulatorTrackStepRepository;
  let useCase: GetTrackStepBySimulatorUseCase;

  beforeEach(() => {
    stepRepo = {
      create: vi.fn(),
      findByTrack: vi.fn(),
      findBySimulator: vi.fn(),
      countByTrack: vi.fn(),
      deleteById: vi.fn(),
      replacePositions: vi.fn(),
      removeAndRecompact: vi.fn(),
    };
    useCase = new GetTrackStepBySimulatorUseCase(stepRepo);
  });

  it('returns null when the simulator is not part of any track', async () => {
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute(ctx, 'sim-1');

    expect(result).toBeNull();
    expect(stepRepo.findBySimulator).toHaveBeenCalledWith(ctx, 'sim-1');
  });

  it('returns the step when the simulator is a track step', async () => {
    const step = new SimulatorTrackStep({
      id: 'step-1',
      trackId: 'track-1',
      academyId: 'org_A',
      simulatorId: 'sim-1',
      position: 1,
      createdAt: now,
      updatedAt: now,
    });
    stepRepo.findBySimulator = vi.fn().mockResolvedValue(step);

    const result = await useCase.execute(ctx, 'sim-1');

    expect(result).toBe(step);
  });
});
