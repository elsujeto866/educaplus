import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorTrackProgress } from '../simulator-track-progress.entity';

/**
 * Port: SimulatorTrackProgressRepository
 *
 * Every method receives TenantContext as the first argument — explicit
 * threading, no implicit globals. The Drizzle adapter that implements this
 * interface wraps all DB calls in withTenant() to enforce RLS.
 *
 * `unique(track_id, clerk_user_id)` backs `create` — a concurrent first-pass
 * for the same (track, learner) surfaces as a Postgres unique-violation
 * (SQLSTATE 23505), which `AdvanceProgressOnPassUseCase` recovers from by
 * re-reading via `findByTrackAndUser` (mirrors
 * `IssueSimulatorCertificateUseCase`'s race recovery).
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

  /** Inserts the FIRST progress row for a (track, learner) pair. */
  create(ctx: TenantContext, progress: SimulatorTrackProgress): Promise<void>;

  /** Persists an advanced frontier for an EXISTING progress row. */
  update(ctx: TenantContext, progress: SimulatorTrackProgress): Promise<void>;
}
