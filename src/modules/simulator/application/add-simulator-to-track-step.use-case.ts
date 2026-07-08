import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrackStep } from '../domain/simulator-track-step.entity';
import {
  SimulatorTrackNotFoundError,
  SimulatorNotFoundError,
  SimulatorNotPublishedError,
  SimulatorAlreadyInTrackError,
  TrackStepPositionConflictError,
} from '../domain/errors';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';
import type { SimulatorTrackStepRepository } from '../domain/ports/simulator-track-step.repository';
import type { SimulatorRepository } from '../domain/ports/simulator.repository';

/** Postgres unique-violation SQLSTATE — duck-typed, no infra import (mirrors IssueSimulatorCertificateUseCase). */
const UNIQUE_VIOLATION_CODE = '23505';

/**
 * `simulator_track_steps` carries TWO unique constraints (see
 * `simulator.schema.ts`): `unique(simulator_id)` and
 * `unique(track_id, position)`. Both surface as SQLSTATE 23505 — they must
 * NOT be collapsed into the same domain error (see `catch` below).
 */
const SIMULATOR_ID_UNIQUE_CONSTRAINT = 'simulator_track_steps_simulator_id_unique';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === UNIQUE_VIOLATION_CODE;
}

/**
 * postgres-js (the driver behind the Drizzle adapter) exposes the violated
 * constraint's name as `constraint_name` on the thrown error. Duck-typed
 * (also accepts `constraint`, some drivers/mocks use the shorter name) —
 * no infra import, mirrors `isUniqueViolation` above.
 */
function uniqueConstraintName(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { constraint_name?: unknown; constraint?: unknown };
  if (typeof e.constraint_name === 'string') return e.constraint_name;
  if (typeof e.constraint === 'string') return e.constraint;
  return undefined;
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
 * module. Only a PUBLISHED simulator may become a step (spec.md "Track
 * authoring": "add EXISTING published simulators as ordered steps") — a
 * draft simulator is rejected with `SimulatorNotPublishedError`. A
 * concurrent/duplicate insert against the DB's `unique(simulator_id)`
 * constraint (design.md "at-most-one-track-per-simulator") surfaces as a
 * unique-violation, mapped here to `SimulatorAlreadyInTrackError` (spec.md
 * "Reject duplicate simulator across tracks"); a unique-violation on the
 * OTHER constraint on this table (`unique(track_id, position)` — a
 * concurrency-only tail-position race) is disambiguated by constraint name
 * and mapped to the distinct `TrackStepPositionConflictError` instead, never
 * mislabeled as "already in track".
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
    if (!simulator.isPublished) throw new SimulatorNotPublishedError(input.simulatorId);

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
        const constraint = uniqueConstraintName(err);
        if (constraint === SIMULATOR_ID_UNIQUE_CONSTRAINT) {
          throw new SimulatorAlreadyInTrackError(input.simulatorId);
        }
        // Any other 23505 on this table can only be `unique(track_id,
        // position)` — a concurrency-only race (two concurrent adds both
        // read the same countByTrack tail position). Never mislabel it as
        // "already in track", which means something entirely different.
        throw new TrackStepPositionConflictError(input.trackId, position);
      }
      throw err;
    }

    return step;
  }
}
