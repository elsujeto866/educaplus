/**
 * Concurrency test — StartAttempt's attempt-limit gate
 * (WARNING-1 / CWE-367 TOCTOU fix).
 *
 * The adversarial verify of Slice S4 found that `StartAttemptUseCase`
 * enforced the per-student attempt-limit via `count` THEN `create`, each as
 * its OWN `withTenant` transaction. Because the two reads/writes were not
 * atomic, N concurrent `startAttemptAction` calls for the SAME
 * (simulatorId, clerkUserId) could each observe `count < attemptLimit`
 * before any of them had inserted, and each insert a new row — exceeding
 * the limit.
 *
 * The fix (`DrizzleSimulatorAttemptRepository.startOrResume`) runs the
 * resume-check + count-check + insert inside ONE transaction, serialized by
 * `SELECT pg_advisory_xact_lock(hashtextextended(<simulatorId>:<clerkUserId>, 0))`
 * acquired BEFORE the first read. The lock is transaction-scoped
 * (`_xact_`), so it is released automatically at COMMIT/ROLLBACK.
 *
 * HARNESS LIMITATION (documented per instructions, not silently downgraded):
 * this "integration" Vitest project does not wire the production Drizzle
 * `db` singleton (which reads `DATABASE_URL`/Clerk env vars via
 * `@/config/env`) to the Docker test Postgres — every other file in this
 * directory tests RLS by issuing raw SQL through `postgres-js` directly,
 * never through the compiled repository classes. Doing otherwise would
 * require loading `.env`-style Clerk secrets into this project just for
 * this one test, which is out of scope for a focused security fix.
 * Consequently this test does NOT call `DrizzleSimulatorAttemptRepository
 * .startOrResume` itself. Instead it fires GENUINE concurrent Postgres
 * transactions (a dedicated connection pool, `max: 10`, so an 8-way race
 * isn't serialized by pool queueing) that execute the EXACT SQL sequence
 * `startOrResume` runs — same lock-key derivation, same
 * resume-check/count-check/insert shape, against the SAME
 * `simulator_attempts` table via the SAME `app_user` role used in
 * production. This proves the underlying Postgres mechanism the fix
 * depends on actually serializes concurrent writers, which is the part of
 * the fix that unit tests (mocked repositories) cannot exercise at all.
 *
 * Two scenarios, mirroring the RLS suite's existing "negative gate"
 * convention (see `simulator-attempts-isolation.spec.ts`):
 *   - `it.fails(...)`: the NAIVE pattern (no lock — literally the buggy
 *     pre-fix shape: read in-progress, read count, conditionally insert,
 *     with no synchronization at all) is expected to let the race exceed
 *     the limit, so the "stays within the cap" assertion FAILS —
 *     `it.fails` marks that a PASS, proving the exploit is real and that
 *     this harness can detect it (not vacuous).
 *   - `it(...)`: the FIXED pattern (advisory lock acquired first) must
 *     keep the total attempt count for the racing student at EXACTLY
 *     `ATTEMPT_LIMIT`, never more, despite 8-way concurrency.
 *
 * Uses the simulator seeded by global-setup (`a0000000-...-000d`,
 * attempt_limit = 3) with dedicated clerk_user_id values per scenario so
 * neither test interferes with the other or with any other isolation spec.
 */

import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { closeAll } from '../db/test-client';

const APP_USER_URL =
  process.env['TEST_APP_USER_URL'] ??
  'postgresql://app_user:changeme_before_prod@localhost:5433/educaplus_test';

// Seeded by global-setup — org_A's simulator, attempt_limit = 3.
const SIMULATOR_ID = 'a0000000-0000-0000-0000-00000000000d';
const ATTEMPT_LIMIT = 3;
const RACER_COUNT = 8;

// Dedicated pool with enough connections that an 8-way race is genuinely
// concurrent — the shared `appUserClient` in test-client.ts caps at
// `max: 3`, which would serialize most of this race through pool queueing
// and defeat the point of the test.
const raceClient = postgres(APP_USER_URL, { max: RACER_COUNT + 2, onnotice: () => {} });

afterAll(async () => {
  await raceClient.end();
  await closeAll();
});

// RLS is FORCE-enabled for app_user on every query — even seed/read helpers
// must run with `app.current_tenant_id` set for the duration, exactly like
// production's withTenant()/the racers below.
async function seedFinishedAttempts(clerkUserId: string, howMany: number): Promise<void> {
  await raceClient.begin(async (tx) => {
    await tx`SELECT set_config('app.current_tenant_id', 'org_A', true)`;
    for (let i = 0; i < howMany; i++) {
      await tx`
        INSERT INTO simulator_attempts
          (simulator_id, academy_id, clerk_user_id, status, frozen_questions, deadline_at, submitted_at, score, passed)
        VALUES
          (${SIMULATOR_ID}, 'org_A', ${clerkUserId}, 'submitted', '[]', now() + interval '30 minutes', now(), 100, true)
      `;
    }
  });
}

async function countAttempts(clerkUserId: string): Promise<number> {
  return raceClient.begin(async (tx) => {
    await tx`SELECT set_config('app.current_tenant_id', 'org_A', true)`;
    const rows = await tx`
      SELECT count(*)::int AS count FROM simulator_attempts
      WHERE simulator_id = ${SIMULATOR_ID} AND clerk_user_id = ${clerkUserId}
    `;
    return Number(rows[0]?.['count'] ?? 0);
  }) as unknown as Promise<number>;
}

/**
 * Pre-establishes RACER_COUNT physical connections in the pool before the
 * race starts. postgres-js opens connections lazily on first use — without
 * this warmup, under `Promise.all` the LAST racer's connection can still be
 * establishing (TCP handshake + auth) while an EARLIER racer's `pg_sleep`
 * window has already closed, narrowing the actual overlap and making the
 * race non-deterministic (observed flake: ~1 in 8 runs).
 */
async function warmPool(): Promise<void> {
  await Promise.all(Array.from({ length: RACER_COUNT }, () => raceClient`SELECT 1`));
}

describe('StartAttempt attempt-limit — concurrency (WARNING-1 fix, CWE-367 TOCTOU)', () => {
  it.fails(
    'DOCUMENTS THE VULNERABILITY — the naive count-then-insert pattern (no advisory lock, mirrors the pre-fix code) lets concurrent requests exceed the attempt limit',
    async () => {
      const clerkUserId = 'user_race_naive';
      // 1 slot remaining (limit 3, 2 already finished) — the exact
      // pre-condition WARNING-1 describes.
      await seedFinishedAttempts(clerkUserId, ATTEMPT_LIMIT - 1);
      await warmPool();

      const racers = Array.from({ length: RACER_COUNT }, () =>
        raceClient.begin(async (tx) => {
          await tx`SELECT set_config('app.current_tenant_id', 'org_A', true)`;

          const inProgress = await tx`
            SELECT id FROM simulator_attempts
            WHERE simulator_id = ${SIMULATOR_ID} AND clerk_user_id = ${clerkUserId} AND status = 'in_progress'
            LIMIT 1
          `;
          if (inProgress[0]) return;

          const countRows = await tx`
            SELECT count(*)::int AS count FROM simulator_attempts
            WHERE simulator_id = ${SIMULATOR_ID} AND clerk_user_id = ${clerkUserId}
          `;
          const used = Number(countRows[0]?.['count'] ?? 0);
          if (used >= ATTEMPT_LIMIT) return;

          // No lock between the count-check above and this insert — the
          // exact TOCTOU window WARNING-1 identified. The deliberate
          // pg_sleep widens that window so all 8 racers deterministically
          // observe the pre-insert count (making the race reproduce every
          // run instead of depending on incidental network/scheduler
          // timing) — this only WIDENS the SAME race a real concurrent
          // production load can hit, it does not fabricate a different bug.
          await tx`SELECT pg_sleep(0.3)`;

          await tx`
            INSERT INTO simulator_attempts
              (simulator_id, academy_id, clerk_user_id, status, frozen_questions, deadline_at)
            VALUES (${SIMULATOR_ID}, 'org_A', ${clerkUserId}, 'in_progress', '[]', now() + interval '30 minutes')
          `;
        }),
      );
      await Promise.all(racers);

      // EXPECTED TO FAIL: several of the 8 racers observe `used < limit`
      // simultaneously (before any of them has committed its insert) and
      // all insert, so the total ends up well above ATTEMPT_LIMIT.
      expect(await countAttempts(clerkUserId)).toBe(ATTEMPT_LIMIT);
    },
  );

  it('THE FIX — an advisory-lock-serialized resume-check + count-check + insert never lets concurrent requests exceed the attempt limit', async () => {
    const clerkUserId = 'user_race_locked';
    // Same pre-condition as the naive scenario: 1 slot remaining.
    await seedFinishedAttempts(clerkUserId, ATTEMPT_LIMIT - 1);
    await warmPool();

    const lockKey = `simulator_attempt_start:${SIMULATOR_ID}:${clerkUserId}`;

    const racers = Array.from({ length: RACER_COUNT }, () =>
      raceClient.begin(async (tx) => {
        await tx`SELECT set_config('app.current_tenant_id', 'org_A', true)`;

        // Mirrors DrizzleSimulatorAttemptRepository.startOrResume /
        // acquireStartLock exactly — same key derivation, same function.
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

        const inProgress = await tx`
          SELECT id FROM simulator_attempts
          WHERE simulator_id = ${SIMULATOR_ID} AND clerk_user_id = ${clerkUserId} AND status = 'in_progress'
          LIMIT 1
        `;
        if (inProgress[0]) return;

        const countRows = await tx`
          SELECT count(*)::int AS count FROM simulator_attempts
          WHERE simulator_id = ${SIMULATOR_ID} AND clerk_user_id = ${clerkUserId}
        `;
        const used = Number(countRows[0]?.['count'] ?? 0);
        if (used >= ATTEMPT_LIMIT) return;

        // SAME widened window as the naive scenario above — proves the
        // lock (acquired before either read, still held here) is what
        // prevents the overshoot, not incidental timing.
        await tx`SELECT pg_sleep(0.3)`;

        await tx`
          INSERT INTO simulator_attempts
            (simulator_id, academy_id, clerk_user_id, status, frozen_questions, deadline_at)
          VALUES (${SIMULATOR_ID}, 'org_A', ${clerkUserId}, 'in_progress', '[]', now() + interval '30 minutes')
        `;
      }),
    );
    await Promise.all(racers);

    // Exactly ATTEMPT_LIMIT rows exist afterward (2 pre-seeded + exactly 1
    // new one — the lock serializes all 8 racers so only the first past the
    // count-check inserts; every later racer sees that row via the
    // in-progress check and resumes instead) — never
    // `ATTEMPT_LIMIT - 1 + RACER_COUNT` like the naive scenario above.
    expect(await countAttempts(clerkUserId)).toBe(ATTEMPT_LIMIT);
  });
});
