import { InvalidSimulatorTrackError } from './errors';

export interface SimulatorTrackProps {
  id: string;
  academyId: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SimulatorTrack aggregate root — an ordered sequence of EXISTING published
 * simulators (Phase 2, gamified-simulators). Does NOT hold the steps
 * themselves; `SimulatorTrackStep` rows reference back to this track's id
 * (design.md "Track authoring"). A track is scoped to exactly one academy
 * (Decision: academy-scoped) and starts in 'draft' — enforced by
 * `CreateTrackUseCase`, not this constructor (a rehydrated track from the
 * repository may legitimately already be 'published').
 *
 * Pure TS — zero infrastructure imports. Mirrors `Simulator`'s
 * publish()/unpublish() immutable-transition shape verbatim.
 */
export class SimulatorTrack {
  readonly id: string;
  readonly academyId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: 'draft' | 'published';
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: SimulatorTrackProps) {
    if (!props.id) throw new Error('SimulatorTrack: id is required');
    if (!props.academyId) throw new Error('SimulatorTrack: academyId is required');
    if (!props.title || !props.title.trim()) {
      throw new InvalidSimulatorTrackError('title is required');
    }

    this.id = props.id;
    this.academyId = props.academyId;
    this.title = props.title;
    this.description = props.description ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get isPublished(): boolean {
    return this.status === 'published';
  }

  /** Returns a new SimulatorTrack instance with status set to 'published'. */
  publish(at: Date = new Date()): SimulatorTrack {
    return new SimulatorTrack({ ...this, status: 'published', updatedAt: at });
  }

  /** Returns a new SimulatorTrack instance with status set to 'draft'. */
  unpublish(at: Date = new Date()): SimulatorTrack {
    return new SimulatorTrack({ ...this, status: 'draft', updatedAt: at });
  }
}
