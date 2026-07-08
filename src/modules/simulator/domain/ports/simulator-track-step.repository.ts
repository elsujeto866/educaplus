import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrackStep } from '../simulator-track-step.entity';

/**
 * Port: SimulatorTrackStepRepository
 *
 * Every method receives TenantContext as the first argument — explicit
 * threading, no implicit globals. The Drizzle adapter that implements this
 * interface wraps all DB calls in withTenant() to enforce RLS.
 */
export interface SimulatorTrackStepRepository {
  create(ctx: TenantContext, step: SimulatorTrackStep): Promise<void>;

  /** Returns all steps for a track, ordered by position ascending. */
  findByTrack(ctx: TenantContext, trackId: string): Promise<SimulatorTrackStep[]>;

  /**
   * `simulatorId` is globally unique across all tracks (design.md fixed
   * decision) — returns the single step referencing it, if any.
   */
  findBySimulator(ctx: TenantContext, simulatorId: string): Promise<SimulatorTrackStep | null>;

  /** Count of steps in a track — used to assign position = count + 1 on creation. */
  countByTrack(ctx: TenantContext, trackId: string): Promise<number>;

  deleteById(ctx: TenantContext, id: string): Promise<void>;

  /**
   * Bulk-rewrites positions for the given steps — used by ReorderTrackSteps
   * to re-compact the contiguous 1..N sequence after a swap. All updates run
   * inside the same tenant-scoped transaction.
   */
  replacePositions(ctx: TenantContext, updates: { id: string; position: number }[]): Promise<void>;

  /**
   * Atomically deletes `stepId` AND rewrites the remaining steps' positions
   * to `updates` — ONE tenant-scoped transaction. Used by RemoveTrackStep:
   * running the delete and the position re-compaction as two SEPARATE
   * transactions would let a failure between them leave a position gap
   * (violating the contiguous-1..N invariant), so both must commit or roll
   * back together.
   */
  removeAndRecompact(
    ctx: TenantContext,
    stepId: string,
    updates: { id: string; position: number }[],
  ): Promise<void>;
}
