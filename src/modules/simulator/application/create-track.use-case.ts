import { assertRole } from '@/shared/kernel/tenant-context';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { SimulatorTrack } from '../domain/simulator-track.entity';
import type { SimulatorTrackRepository } from '../domain/ports/simulator-track.repository';

export interface CreateTrackInput {
  /** Caller-supplied UUID for the new track. */
  id: string;
  academyId: string;
  title: string;
  description?: string | null;
}

/**
 * CreateTrackUseCase
 *
 * Persists a new, empty gamified track scoped to the caller's academy,
 * always in 'draft' status. Steps are added afterwards via
 * `AddSimulatorToTrackStepUseCase`. Mirrors `CreateSimulatorUseCase`'s shape
 * minus the bank binding (a track has no single required dependency at
 * creation time).
 *
 * Authorization: admin or instructor.
 */
export class CreateTrackUseCase {
  constructor(private readonly trackRepo: SimulatorTrackRepository) {}

  async execute(ctx: TenantContext, input: CreateTrackInput): Promise<SimulatorTrack> {
    assertRole(ctx, ['admin', 'instructor']);

    const now = new Date();
    const track = new SimulatorTrack({
      id: input.id,
      academyId: input.academyId,
      title: input.title,
      description: input.description ?? null,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });

    await this.trackRepo.create(ctx, track);
    return track;
  }
}
