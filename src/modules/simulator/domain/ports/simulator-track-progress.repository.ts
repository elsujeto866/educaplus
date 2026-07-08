import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrackProgress } from '../simulator-track-progress.entity';

/**
 * Port: SimulatorTrackProgressRepository
 *
 * Every method receives TenantContext as the first argument — explicit
 * threading, no implicit globals. The Drizzle adapter that implements this
 * interface wraps all DB calls in withTenant() to enforce RLS.
 *
 * `unique(track_id, clerk_user_id)` backs `upsertAdvance` — it is a SINGLE
 * race-safe `INSERT ... ON CONFLICT (track_id, clerk_user_id) DO UPDATE`
 * that never regresses the persisted frontier: the DB adapter sets
 * `highest_unlocked_position = GREATEST(existing, incoming)`. This removes
 * the lost-update window a separate create/update pair would otherwise have
 * (two overlapping reconciliations racing a read-compute-write cycle could
 * let a stale, lower write clobber a newer, higher one).
 */
export interface SimulatorTrackProgressRepository {
  /**
   * The learner's progress row for this track, or `null` if none exists yet
   * — the ABSENCE of a row means the frontier is implicitly 1 (step 1 open
   * by default, design.md).
   */
  findByTrackAndUser(
    ctx: TenantContext,
    trackId: string,
    clerkUserId: string,
  ): Promise<SimulatorTrackProgress | null>;

  /**
   * Monotonic upsert — creates the row if none exists yet for this
   * (track, learner) pair, or advances the persisted frontier to
   * `GREATEST(existing, incoming)` if one already does. NEVER regresses,
   * even when two overlapping calls race each other. Returns the row AS
   * PERSISTED after the upsert, which may differ from `progress`'s
   * `highestUnlockedPosition` when a concurrent winner already advanced the
   * frontier further — callers must treat this return value as the source
   * of truth, not their own locally-computed candidate.
   */
  upsertAdvance(ctx: TenantContext, progress: SimulatorTrackProgress): Promise<SimulatorTrackProgress>;
}
