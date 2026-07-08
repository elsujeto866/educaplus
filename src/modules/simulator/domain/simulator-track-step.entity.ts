import { InvalidSimulatorTrackStepError } from './errors';

export interface SimulatorTrackStepProps {
  id: string;
  trackId: string;
  academyId: string;
  simulatorId: string;
  /** 1-based position within the track; contiguous 1..N, no gaps/dupes. */
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SimulatorTrackStep entity — one row per (track, simulator). `position`
 * must be a positive integer (design.md "inv: position>=1"); the
 * contiguous-1..N invariant across a whole track spans multiple rows and is
 * therefore enforced at the use-case level (AddSimulatorToTrackStep,
 * ReorderTrackSteps, RemoveTrackStep), not here. `simulatorId` is globally
 * unique across all tracks — a simulator belongs to at most one track at a
 * time (design.md fixed decision) — enforced by the DB `unique(simulator_id)`
 * constraint + `AddSimulatorToTrackStepUseCase` mapping the resulting
 * unique-violation to `SimulatorAlreadyInTrackError`.
 *
 * Pure TS — zero infrastructure imports.
 */
export class SimulatorTrackStep {
  readonly id: string;
  readonly trackId: string;
  readonly academyId: string;
  readonly simulatorId: string;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: SimulatorTrackStepProps) {
    if (!props.id) throw new Error('SimulatorTrackStep: id is required');
    if (!props.trackId) throw new Error('SimulatorTrackStep: trackId is required');
    if (!props.academyId) throw new Error('SimulatorTrackStep: academyId is required');
    if (!props.simulatorId) throw new Error('SimulatorTrackStep: simulatorId is required');
    if (!Number.isInteger(props.position) || props.position < 1) {
      throw new InvalidSimulatorTrackStepError('position must be a positive integer (>= 1)');
    }

    this.id = props.id;
    this.trackId = props.trackId;
    this.academyId = props.academyId;
    this.simulatorId = props.simulatorId;
    this.position = props.position;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Returns a new SimulatorTrackStep instance repositioned to `position`.
   * Used by ReorderTrackSteps/RemoveTrackStep to re-compact positions after
   * a swap or a deletion — the contiguous 1..N invariant across the whole
   * track is the caller's responsibility, this only rebuilds one row.
   */
  withPosition(position: number, at: Date = new Date()): SimulatorTrackStep {
    return new SimulatorTrackStep({ ...this, position, updatedAt: at });
  }
}
