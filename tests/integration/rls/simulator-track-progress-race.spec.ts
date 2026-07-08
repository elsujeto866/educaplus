/**
 * Integration test — the race-recovery sequence
 * `AdvanceProgressOnPassUseCase` relies on for `simulator_track_progress`
 * (gamified-simulators change, Phase 3 — progression).
 *
 * `simulator_track_progress` carries `unique(track_id, clerk_user_id)` (see
 * `simulator.schema.ts`) — ONE progress row per (track, learner). The
 * use-case's race recovery (mirrors `IssueSimulatorCertificateUseCase`)
 * assumes this constraint is REAL at the DB level: a concurrent first-pass
 * INSERT for the same (track, learner) pair must be rejected by Postgres
 * with SQLSTATE 23505, not silently accepted or handled only by
 * application-level convention.
 *
 * HARNESS LIMITATION (same as `simulator-track-step-reorder.spec.ts` and
 * `attempt-limit-concurrency.spec.ts`): this "integration" Vitest project
 * does not wire the production Drizzle `db` singleton (requires
 * `DATABASE_URL`/Clerk env vars via `@/config/env`) to the Docker test
 * Postgres. This file proves the DB-level behavior with raw SQL through
 * `postgres-js` directly, issuing the IDENTICAL statement shape
 * `DrizzleSimulatorTrackProgressRepository.create` runs, against the SAME
 * `simulator_track_progress` table via the SAME `app_user` role used in
 * production.
 *
 * Seeds its own track + progress row (independent from global-setup's
 * org_A track/progress and the reorder spec's track) so this file can
 * freely mutate/re-seed without interfering with
 * `simulator-track-progress-isolation.spec.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asTenant, closeAll, superuserClient } from '../db/test-client';

// Dedicated, unlikely-to-collide fixture IDs — org_A tenant only.
const BANK_ID = 'a0000000-0000-0000-0000-00000000000b'; // seeded by global-setup
const TRACK_ID = 'a0000000-0000-0000-0000-000000000030';
const SIM_1 = 'a0000000-0000-0000-0000-000000000031';
const STEP_1 = 'a0000000-0000-0000-0000-000000000032';
const PROGRESS_1 = 'a0000000-0000-0000-0000-000000000033';
const PROGRESS_RACED = 'a0000000-0000-0000-0000-000000000034';
const LEARNER = 'user_race_1';

async function seedTrackAndStep(): Promise<void> {
  await superuserClient`
    INSERT INTO simulator_tracks (id, academy_id, title, status)
    VALUES (${TRACK_ID}, 'org_A', 'Progress Race Test Track', 'draft')
  `;
  await superuserClient`
    INSERT INTO simulators (id, academy_id, bank_id, title, question_count, time_limit_minutes, status)
    VALUES (${SIM_1}, 'org_A', ${BANK_ID}, 'Progress Race Sim 1', 1, 10, 'published')
  `;
  await superuserClient`
    INSERT INTO simulator_track_steps (id, track_id, academy_id, simulator_id, position)
    VALUES (${STEP_1}, ${TRACK_ID}, 'org_A', ${SIM_1}, 1)
  `;
}

async function cleanup(): Promise<void> {
  await superuserClient`DELETE FROM simulator_track_progress WHERE track_id = ${TRACK_ID}`;
  await superuserClient`DELETE FROM simulator_track_steps WHERE track_id = ${TRACK_ID}`;
  await superuserClient`DELETE FROM simulator_tracks WHERE id = ${TRACK_ID}`;
  await superuserClient`DELETE FROM simulators WHERE id = ${SIM_1}`;
}

describe('simulator_track_progress — unique(track_id, clerk_user_id) backs AdvanceProgressOnPassUseCase race recovery', () => {
  beforeAll(async () => {
    await cleanup();
    await seedTrackAndStep();
  });

  afterAll(async () => {
    await cleanup();
    await closeAll();
  });

  // -------------------------------------------------------------------------
  // Guard case — proves the constraint is real, so the "fix" success below
  // is meaningful and not vacuously green.
  // -------------------------------------------------------------------------

  it('GUARD: a second INSERT for the same (track_id, clerk_user_id) is rejected by unique(track_id, clerk_user_id)', async () => {
    // First insert — mirrors DrizzleSimulatorTrackProgressRepository.create.
    await asTenant(
      'org_A',
      (tx) =>
        tx`
          INSERT INTO simulator_track_progress (id, track_id, academy_id, clerk_user_id, highest_unlocked_position)
          VALUES (${PROGRESS_1}, ${TRACK_ID}, 'org_A', ${LEARNER}, 2)
        `,
    );

    // Concurrent/duplicate insert for the SAME (track, learner) pair — the
    // exact shape a race between two AdvanceProgressOnPassUseCase calls
    // would produce.
    await expect(
      asTenant(
        'org_A',
        (tx) =>
          tx`
            INSERT INTO simulator_track_progress (id, track_id, academy_id, clerk_user_id, highest_unlocked_position)
            VALUES (${PROGRESS_RACED}, ${TRACK_ID}, 'org_A', ${LEARNER}, 2)
          `,
      ),
    ).rejects.toThrow();

    // The losing insert must not have left a second row behind.
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM simulator_track_progress WHERE track_id = ${TRACK_ID} AND clerk_user_id = ${LEARNER}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['id']).toBe(PROGRESS_1);
  });

  // -------------------------------------------------------------------------
  // THE FIX — the exact recovery sequence AdvanceProgressOnPassUseCase runs:
  // insert fails with 23505 -> re-read -> return the winning row.
  // -------------------------------------------------------------------------

  it('THE FIX: after a unique-violation, re-reading by (track_id, clerk_user_id) returns the SAME winning row the use-case would return', async () => {
    // Row from the GUARD test above already exists at highestUnlockedPosition=2.
    let raceError: unknown;
    try {
      await asTenant(
        'org_A',
        (tx) =>
          tx`
            INSERT INTO simulator_track_progress (id, track_id, academy_id, clerk_user_id, highest_unlocked_position)
            VALUES (${PROGRESS_RACED}, ${TRACK_ID}, 'org_A', ${LEARNER}, 2)
          `,
      );
    } catch (err) {
      raceError = err;
    }

    expect(raceError).toBeDefined();
    expect((raceError as { code?: string }).code).toBe('23505');

    // Mirrors AdvanceProgressOnPassUseCase's recovery: re-read instead of
    // surfacing the DB error.
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id, highest_unlocked_position FROM simulator_track_progress WHERE track_id = ${TRACK_ID} AND clerk_user_id = ${LEARNER}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['id']).toBe(PROGRESS_1);
    expect(rows[0]?.['highest_unlocked_position']).toBe(2);
  });

  it('a SECOND learner on the SAME track gets their OWN row — the constraint is scoped per (track, learner), not per track', async () => {
    await asTenant(
      'org_A',
      (tx) =>
        tx`
          INSERT INTO simulator_track_progress (id, track_id, academy_id, clerk_user_id, highest_unlocked_position)
          VALUES (${PROGRESS_RACED}, ${TRACK_ID}, 'org_A', 'user_race_2', 2)
        `,
    );

    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT clerk_user_id FROM simulator_track_progress WHERE track_id = ${TRACK_ID} ORDER BY clerk_user_id`,
    );
    expect(rows.map((r) => r['clerk_user_id'])).toEqual([LEARNER, 'user_race_2']);
  });
});
