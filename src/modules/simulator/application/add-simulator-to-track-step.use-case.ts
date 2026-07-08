import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrackStep } from '../domain/simulator-track-step.entity';
import { SimulatorTrackNotFoundError, SimulatorNotFoundError, SimulatorAlreadyInTrackError } from '../domain/errors';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/** Postgres unique-violation SQLSTATE — duck-typed, no infra import (mirrors IssueSimulatorCertificateUseCase). */
const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === UNIQUE_VIOLATION_CODE;
}

export interface AddSimulatorToTrackStepInput {
  /** Caller-supplied UUID for the new step row. */
  id: string;
  trackId: string;
  academyId: string;
  simulatorId: string;
}

/**
 * AddSimulatorToTrackStepUseCase
 *
 * Appends an EXISTING simulator to a track at position = countByTrack + 1
 * (spec.md "Create track and add steps" — order stays contiguous by
 * construction, every add is at the tail). `simulatorRepo.findById` is
 * tenant-scoped (RLS-backed) so a cross-academy simulator id resolves to
 * `null` exactly like a nonexistent one (spec.md "Reject cross-academy
 * simulator"), collapsing both cases into `SimulatorNotFoundError` — mirrors
 * the "not found or not mine" convention already established across this
 * module. A concurrent/duplicate insert against the DB's
 * `unique(simulator_id)` constraint (design.md "at-most-one-track-per-
 * simulator") surfaces as a unique-violation, mapped here to
 * `SimulatorAlreadyInTrackError` (spec.md "Reject duplicate simulator
 * across tracks").
 *
 * Authorization: admin or instructor.
 */
export class AddSimulatorToTrackStepUseCase {
  constructor(
    private readonly trackRepo: SimulatorTrackRepository,
    private readonly stepRepo: SimulatorTrackStepRepository,
    private readonly simulatorRepo: SimulatorRepository,
  ) {}

  async execute(ctx: TenantContext, input: AddSimulatorToTrackStepInput): Promise<SimulatorTrackStep> {
    assertRole(ctx, ['admin', 'instructor']);

    const track = await this.trackRepo.findById(ctx, input.trackId);
    if (!track) throw new SimulatorTrackNotFoundError(input.trackId);

    const simulator = await this.simulatorRepo.findById(ctx, input.simulatorId);
    if (!simulator) throw new SimulatorNotFoundError(input.simulatorId);

    const position = (await this.stepRepo.countByTrack(ctx, input.trackId)) + 1;
    const now = new Date();
    const step = new SimulatorTrackStep({
      id: input.id,
      trackId: input.trackId,
      academyId: input.academyId,
      simulatorId: input.simulatorId,
      position,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await this.stepRepo.create(ctx, step);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new SimulatorAlreadyInTrackError(input.simulatorId);
      }
      throw err;
    }

    return step;
  }
}
