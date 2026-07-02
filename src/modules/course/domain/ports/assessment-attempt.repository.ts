import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { AssessmentAttempt } from '../assessment-attempt.entity';

/**
 * Port: AssessmentAttemptRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * No unique constraint backs (assessmentId, clerkUserId) — unlimited
 * retakes are persisted as distinct rows, so `create` never conflicts.
 */
export interface AssessmentAttemptRepository {
  create(ctx: TenantContext, attempt: AssessmentAttempt): Promise<void>;

  /** All attempts for (assessmentId, clerkUserId), newest first (createdAt desc). */
  findByUserAndAssessment(
    ctx: TenantContext,
    assessmentId: string,
    clerkUserId: string,
  ): Promise<AssessmentAttempt[]>;

  /** The most recent passing attempt, or null if the user has never passed. */
  findLatestPassed(
    ctx: TenantContext,
    assessmentId: string,
    clerkUserId: string,
  ): Promise<AssessmentAttempt | null>;
}
