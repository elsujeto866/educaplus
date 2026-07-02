import { and, desc, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { assessmentAttempts } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { AssessmentAttempt } from '../domain/assessment-attempt.entity';
import type { SubmittedAnswer } from '../domain/assessment-attempt.entity';
import type { AssessmentAttemptRepository } from '../domain/ports/assessment-attempt.repository';

/**
 * Maps a raw DB row to an AssessmentAttempt entity.
 *
 * `answers` round-trips as typed JSONB. It is trusted on read without
 * re-validating through assertAnswersValid because every write already
 * passed validation in the use-case layer (same trust model as
 * assessments.questions).
 */
function toEntity(row: typeof assessmentAttempts.$inferSelect): AssessmentAttempt {
  return new AssessmentAttempt({
    id: row.id,
    assessmentId: row.assessmentId,
    academyId: row.academyId,
    clerkUserId: row.clerkUserId,
    answers: row.answers as unknown as SubmittedAnswer[],
    score: row.score,
    passed: row.passed,
    createdAt: row.createdAt,
  });
}

/**
 * Drizzle implementation of AssessmentAttemptRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * No unique constraint backs (assessmentId, clerkUserId) — create always
 * inserts a fresh row, never conflicts (unlimited retakes).
 */
export class DrizzleAssessmentAttemptRepository implements AssessmentAttemptRepository {
  async create(ctx: TenantContext, attempt: AssessmentAttempt): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(assessmentAttempts).values({
        id: attempt.id,
        assessmentId: attempt.assessmentId,
        academyId: attempt.academyId,
        clerkUserId: attempt.clerkUserId,
        answers: attempt.answers as unknown as Record<string, unknown>[],
        score: attempt.score,
        passed: attempt.passed,
        createdAt: attempt.createdAt,
      }),
    );
  }

  async findByUserAndAssessment(
    ctx: TenantContext,
    assessmentId: string,
    clerkUserId: string,
  ): Promise<AssessmentAttempt[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(assessmentAttempts)
        .where(
          and(
            eq(assessmentAttempts.assessmentId, assessmentId),
            eq(assessmentAttempts.clerkUserId, clerkUserId),
          ),
        )
        .orderBy(desc(assessmentAttempts.createdAt));
      return rows.map(toEntity);
    });
  }

  async findLatestPassed(
    ctx: TenantContext,
    assessmentId: string,
    clerkUserId: string,
  ): Promise<AssessmentAttempt | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(assessmentAttempts)
        .where(
          and(
            eq(assessmentAttempts.assessmentId, assessmentId),
            eq(assessmentAttempts.clerkUserId, clerkUserId),
            eq(assessmentAttempts.passed, true),
          ),
        )
        .orderBy(desc(assessmentAttempts.createdAt))
        .limit(1);
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }
}
