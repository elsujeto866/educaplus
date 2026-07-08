import { InvalidSimulatorTrackProgressError } from './errors';

export interface SimulatorTrackProgressProps {
  id: string;
  trackId: string;
  academyId: string;
  /** Opaque Clerk user identifier — the learner this progress row belongs to. */
  clerkUserId: string;
  /**
   * Monotonic frontier — the highest step position unlocked so far. Defaults
   * to 1 (step 1 is open by default, design.md "Step 1 open by default").
   */
  highestUnlockedPosition?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SimulatorTrackProgress — one row per (track, learner). A SINGLE monotonic
 * frontier integer fully derives every step's status (design.md "Progress
 * modeled as a single monotonic frontier integer"): positions strictly below
 * the frontier are passed, the frontier itself is unlocked, positions above
 * are locked. A learner can only ever START the frontier step, so the only
 * step they can pass is the frontier — advancement always moves the frontier
 * by exactly 1, and the frontier NEVER regresses.
 *
 * Pure TS — zero infrastructure imports. Mirrors `SimulatorTrackStep`'s
 * validation shape (required-field checks throw a plain `Error`; the
 * position invariant throws the dedicated domain error).
 */
export class SimulatorTrackProgress {
  readonly id: string;
  readonly trackId: string;
  readonly academyId: string;
  readonly clerkUserId: string;
  readonly highestUnlockedPosition: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: SimulatorTrackProgressProps) {
    if (!props.id) throw new Error('SimulatorTrackProgress: id is required');
    if (!props.trackId) throw new Error('SimulatorTrackProgress: trackId is required');
    if (!props.academyId) throw new Error('SimulatorTrackProgress: academyId is required');
    if (!props.clerkUserId) throw new Error('SimulatorTrackProgress: clerkUserId is required');

    const highestUnlockedPosition = props.highestUnlockedPosition ?? 1;
    if (!Number.isInteger(highestUnlockedPosition) || highestUnlockedPosition < 1) {
      throw new InvalidSimulatorTrackProgressError(
        'highestUnlockedPosition must be a positive integer (>= 1)',
      );
    }

    this.id = props.id;
    this.trackId = props.trackId;
    this.academyId = props.academyId;
    this.clerkUserId = props.clerkUserId;
    this.highestUnlockedPosition = highestUnlockedPosition;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Returns a new instance with the frontier advanced to `to`, IF `to` is
   * strictly greater than the current frontier. Otherwise returns `this`
   * UNCHANGED — this is what makes the invariant hold: passing an
   * already-passed step (or any position at/behind the frontier) is a pure,
   * idempotent no-op, never a regression.
   */
  advanceTo(to: number, at: Date = new Date()): SimulatorTrackProgress {
    if (to <= this.highestUnlockedPosition) return this;
    return new SimulatorTrackProgress({ ...this, highestUnlockedPosition: to, updatedAt: at });
  }
}
