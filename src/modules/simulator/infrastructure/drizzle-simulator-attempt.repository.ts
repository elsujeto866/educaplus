import { and, eq, sql } from 'drizzle-orm';
import { withTenant, type TenantTx } from '@/shared/infrastructure/db/with-tenant';
import { simulatorAttempts } from '@/shared/infrastructure/db/schema/simulator.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import {
  SimulatorAttempt,
  type FrozenQuestion,
  type SubmittedAnswer,
} from '../domain/simulator-attempt.entity';
import type {
  SimulatorAttemptRepository,
  StartOrResumeResult,
} from '../domain/ports/simulator-attempt.repository';

/**
 * Maps a raw DB row to a SimulatorAttempt entity. `frozenQuestions`/
 * `answers` round-trip as typed JSONB — trusted on read without
 * re-validating, since every write already passed validation in the
 * use-case layer (same trust model as `assessments.questions`).
 */
function toEntity(row: typeof simulatorAttempts.$inferSelect): SimulatorAttempt {
  return new SimulatorAttempt({
    id: row.id,
    simulatorId: row.simulatorId,
    academyId: row.academyId,
    clerkUserId: row.clerkUserId,
    status: row.status,
    frozenQuestions: row.frozenQuestions as unknown as FrozenQuestion[],
    answers: row.answers as unknown as SubmittedAnswer[] | null,
    score: row.score,
    passed: row.passed,
    startedAt: row.startedAt,
    deadlineAt: row.deadlineAt,
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
  });
}

/** Shared row shape for INSERT — reused by both `create()` and `startOrResume()`. */
function toInsertValues(attempt: SimulatorAttempt) {
  return {
    id: attempt.id,
    simulatorId: attempt.simulatorId,
    academyId: attempt.academyId,
    clerkUserId: attempt.clerkUserId,
    status: attempt.status,
    frozenQuestions: attempt.frozenQuestions as unknown as Record<string, unknown>[],
    answers: attempt.answers as unknown as Record<string, unknown>[] | null,
    score: attempt.score,
    passed: attempt.passed,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    submittedAt: attempt.submittedAt,
    createdAt: attempt.createdAt,
  };
}

/**
 * Serializes concurrent `startOrResume` callers for the SAME
 * (simulatorId, clerkUserId) pair onto one Postgres advisory-lock key.
 * `hashtextextended(text, seed bigint)` returns a bigint, matching the
 * `pg_advisory_xact_lock(key bigint)` overload — no need for the two-int32
 * form. Scoped to the transaction (`_xact_`) so it releases automatically
 * at COMMIT/ROLLBACK — no manual unlock, no risk of a leaked lock outliving
 * the request.
 */
function lockKeyFor(simulatorId: string, clerkUserId: string): string {
  return `simulator_attempt_start:${simulatorId}:${clerkUserId}`;
}

async function acquireStartLock(
  tx: TenantTx,
  simulatorId: string,
  clerkUserId: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKeyFor(simulatorId, clerkUserId)}, 0))`,
  );
}

/**
 * Drizzle implementation of SimulatorAttemptRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * RLS enforces ACADEMY isolation only; cross-USER isolation within the
 * same academy is enforced by the use-case layer (see
 * SubmitAttemptUseCase/GetAttemptUseCase docstrings), not here.
 */
export class DrizzleSimulatorAttemptRepository implements SimulatorAttemptRepository {
  async create(ctx: TenantContext, attempt: SimulatorAttempt): Promise<void> {
    await withTenant(ctx, (tx) => tx.insert(simulatorAttempts).values(toInsertValues(attempt)));
  }

  async findById(ctx: TenantContext, id: string): Promise<SimulatorAttempt | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(simulatorAttempts).where(eq(simulatorAttempts.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  /**
   * SECURITY FIX (CWE-367 TOCTOU, WARNING-1): the resume-check, the
   * attempt-limit count, and the insert all run inside the SAME
   * `withTenant` transaction, serialized by `acquireStartLock` BEFORE any
   * read. Without the lock, two concurrent callers could both read
   * `used < attemptLimit` before either had inserted, and both insert —
   * exceeding the limit. With the lock, the second caller's read is
   * blocked until the first caller's transaction commits (or rolls back),
   * so it always observes the first caller's write.
   */
  async startOrResume(
    ctx: TenantContext,
    candidate: SimulatorAttempt,
    attemptLimit: number,
  ): Promise<StartOrResumeResult> {
    return withTenant(ctx, async (tx) => {
      await acquireStartLock(tx, candidate.simulatorId, candidate.clerkUserId);

      const inProgressRows = await tx
        .select()
        .from(simulatorAttempts)
        .where(
          and(
            eq(simulatorAttempts.simulatorId, candidate.simulatorId),
            eq(simulatorAttempts.clerkUserId, candidate.clerkUserId),
            eq(simulatorAttempts.status, 'in_progress'),
          ),
        )
        .limit(1);
      const existing = inProgressRows[0];
      if (existing) {
        return { kind: 'resumed', attempt: toEntity(existing) };
      }

      const countRows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(simulatorAttempts)
        .where(
          and(
            eq(simulatorAttempts.simulatorId, candidate.simulatorId),
            eq(simulatorAttempts.clerkUserId, candidate.clerkUserId),
          ),
        );
      const used = countRows[0]?.count ?? 0;
      if (used >= attemptLimit) {
        return { kind: 'limit_reached' };
      }

      await tx.insert(simulatorAttempts).values(toInsertValues(candidate));
      return { kind: 'created', attempt: candidate };
    });
  }

  async update(ctx: TenantContext, attempt: SimulatorAttempt): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(simulatorAttempts)
        .set({
          status: attempt.status,
          answers: attempt.answers as unknown as Record<string, unknown>[] | null,
          score: attempt.score,
          passed: attempt.passed,
          submittedAt: attempt.submittedAt,
        })
        .where(eq(simulatorAttempts.id, attempt.id)),
    );
  }
}
