import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { SimulatorAttempt } from '../simulator-attempt.entity';

/**
 * Outcome of `startOrResume` — a closed set so the use-case can exhaustively
 * switch on `kind` without a default/fallthrough branch.
 */
export type StartOrResumeResult =
  | { readonly kind: 'resumed'; readonly attempt: SimulatorAttempt }
  | { readonly kind: 'limit_reached' }
  | { readonly kind: 'created'; readonly attempt: SimulatorAttempt };

/**
 * Port: SimulatorAttemptRepository
 *
 * Every method receives TenantContext first — explicit threading, no
 * globals. The Drizzle adapter wraps all DB calls in withTenant() to
 * enforce RLS (tenant/academy isolation only — see Decision note below,
 * cross-USER isolation within the same academy is enforced at the
 * use-case level, NOT by RLS, since RLS's discriminator is academy_id).
 * No unique constraint backs (simulatorId, clerkUserId) — multiple
 * attempts up to the simulator's attemptLimit (enforced at the use-case
 * level via `startOrResume`).
 *
 * SECURITY FIX (CWE-367 TOCTOU): the resume-check + attempt-limit count +
 * insert used to be THREE separate repository calls (`findInProgress`,
 * `countByUserAndSimulator`, `create`), each opening its OWN `withTenant`
 * transaction. Because they were not atomic, concurrent `StartAttempt`
 * calls for the same (simulatorId, clerkUserId) could each observe
 * `count < attemptLimit` before any of them had inserted, and each create
 * a row — exceeding the limit. `startOrResume` collapses all three steps
 * into ONE atomic, lock-serialized operation (see
 * DrizzleSimulatorAttemptRepository for the mechanism) so the decision
 * (resume / reject / create) and the write happen under the same lock —
 * closing the race. The atomicity mechanism itself lives in the
 * infrastructure layer; this port only exposes the outcome.
 */
export interface SimulatorAttemptRepository {
  create(ctx: TenantContext, attempt: SimulatorAttempt): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<SimulatorAttempt | null>;

  /**
   * Atomically resolves the "start attempt" decision for
   * (candidate.simulatorId, candidate.clerkUserId):
   *   - an existing in_progress attempt is returned as `{kind:'resumed'}`
   *     (no insert, no timer reset — Decision 5/6);
   *   - otherwise, if the caller's lifetime attempt count is already
   *     `>= attemptLimit`, returns `{kind:'limit_reached'}` (no insert);
   *   - otherwise persists `candidate` and returns `{kind:'created'}`.
   *
   * MUST serialize concurrent callers for the SAME (simulatorId,
   * clerkUserId) pair so the count-check and the insert are never split
   * by another caller's insert — see the SECURITY FIX note above.
   */
  startOrResume(
    ctx: TenantContext,
    candidate: SimulatorAttempt,
    attemptLimit: number,
  ): Promise<StartOrResumeResult>;

  /** Persists a status transition (submit/expire) — answers/score/passed/submittedAt. */
  update(ctx: TenantContext, attempt: SimulatorAttempt): Promise<void>;
}
