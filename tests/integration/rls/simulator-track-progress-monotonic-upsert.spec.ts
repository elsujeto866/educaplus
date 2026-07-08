/**
 * Integration test — proves the monotonic-upsert fix for the CONFIRMED HIGH
 * adversarial-review finding on `simulator_track_progress` (gamified-simulators
 * change, Phase 3 — progression, PR3 review fix): the persisted frontier could
 * REGRESS under a lost-update race.
 *
 * BEFORE the fix, `DrizzleSimulatorTrackProgressRepository.update` was a
 * blind id-keyed `UPDATE ... SET highest_unlocked_position = X WHERE id =
 * ...` with NO monotonic guard. Combined with `AdvanceProgressOnPassUseCase`'s
 * read-compute-write cycle, two overlapping reconciliations could race: a
 * stale (older, lower) write applied AFTER a newer (higher) one would
 * silently lower the persisted frontier.
 *
 * AFTER the fix, `upsertAdvance` is a SINGLE
 * `INSERT ... ON CONFLICT (track_id, clerk_user_id) DO UPDATE SET
 * highest_unlocked_position = GREATEST(existing, incoming)` — this can never
 * regress, regardless of write order, because Postgres evaluates GREATEST
 * against the row as it exists at the time each individual statement
 * commits.
 *
 * HARNESS LIMITATION (same as `simulator-track-progress-race.spec.ts` and
 * `simulator-track-step-remove.spec.ts`): this "integration" Vitest project
 * does not wire the production Drizzle `db` singleton to the Docker test
 * Postgres. This file proves the DB-level behavior with raw SQL through
 * `postgres-js` directly, issuing the IDENTICAL statement shapes the OLD
 * (blind UPDATE) and NEW (GREATEST upsert) repository code run, against the
 * SAME `simulator_track_progress` table via the SAME `app_user` role used in
 * production.
 *
 * Seeds its own track + progress rows (fresh fixture range
 * a0000000-...-000040 through ...-000048 — the reorder spec uses ...-000020
 * through ...-000028, the step-remove spec uses ...-000030 through
 * ...-000038, the progress-race spec uses ...-000050 through ...-000054,
 * and global-setup uses ...-000010 through ...-000012) so this file can
 * freely mutate/re-seed without interfering with any of them.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asTenant, closeAll, superuserClient } from '../db/test-client';

const BANK_ID = 'a0000000-0000-0000-0000-00000000000b'; // seeded by global-setup
const TRACK_ID = 'a0000000-0000-0000-0000-000000000040';
const SIM_1 = 'a0000000-0000-0000-0000-000000000041';
const STEP_1 = 'a0000000-0000-0000-0000-000000000042';

async function seedTrackAndStep(): Promise<void> {
  await superuserClient`
    INSERT INTO simulator_tracks (id, academy_id, title, status)
    VALUES (${TRACK_ID}, 'org_A', 'Monotonic Upsert Test Track', 'draft')
  `;
  await superuserClient`
    INSERT INTO simulators (id, academy_id, bank_id, title, question_count, time_limit_minutes, status)
    VALUES (${SIM_1}, 'org_A', ${BANK_ID}, 'Monotonic Upsert Sim 1', 1, 10, 'published')
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

describe('simulator_track_progress — monotonic upsert prevents the persisted frontier from regressing', () => {
  beforeAll(async () => {
    await cleanup();
    await seedTrackAndStep();
  });

  afterAll(async () => {
    await cleanup();
    await closeAll();
  });

  // -------------------------------------------------------------------------
  // GUARD — reproduces the BUG mechanically: the OLD blind id-keyed UPDATE
  // (no monotonic guard) DOES regress when a stale write lands after a newer
  // one. This proves the vulnerability is real, so THE FIX test below is not
  // vacuously green.
  // -------------------------------------------------------------------------

  it('GUARD (reproduces the bug): a blind id-keyed UPDATE with no monotonic guard REGRESSES when a stale lower write lands after a higher one', async () => {
    const learner = 'user_guard';
    const rowId = 'a0000000-0000-0000-0000-000000000043';

    await asTenant(
      'org_A',
      (tx) =>
        tx`
          INSERT INTO simulator_track_progress (id, track_id, academy_id, clerk_user_id, highest_unlocked_position)
          VALUES (${rowId}, ${TRACK_ID}, 'org_A', ${learner}, 1)
        `,
    );

    // Newer, higher write arrives first — mirrors OLD
    // `DrizzleSimulatorTrackProgressRepository.update`: a blind
    // `.set({ highestUnlockedPosition }).where(eq(id, ...))`.
    await asTenant(
      'org_A',
      (tx) =>
        tx`UPDATE simulator_track_progress SET highest_unlocked_position = 3 WHERE id = ${rowId}`,
    );

    // Stale, lower write (from an overlapping, slower reconciliation) lands
    // AFTER the newer one — same blind shape, no guard.
    await asTenant(
      'org_A',
      (tx) =>
        tx`UPDATE simulator_track_progress SET highest_unlocked_position = 2 WHERE id = ${rowId}`,
    );

    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT highest_unlocked_position FROM simulator_track_progress WHERE id = ${rowId}`,
    );
    expect(rows).toHaveLength(1);
    // THE BUG: the frontier REGRESSED from 3 down to 2 — exactly the
    // lost-update finding this fix closes.
    expect(rows[0]?.['highest_unlocked_position']).toBe(2);
  });

  // -------------------------------------------------------------------------
  // THE FIX — the exact SQL shape `DrizzleSimulatorTrackProgressRepository
  // .upsertAdvance` runs: INSERT ... ON CONFLICT (track_id, clerk_user_id)
  // DO UPDATE SET highest_unlocked_position = GREATEST(existing, incoming).
  // -------------------------------------------------------------------------

  function upsertAdvance(
    tx: Parameters<Parameters<typeof asTenant>[1]>[0],
    id: string,
    learner: string,
    value: number,
  ) {
    return tx`
      INSERT INTO simulator_track_progress (id, track_id, academy_id, clerk_user_id, highest_unlocked_position)
      VALUES (${id}, ${TRACK_ID}, 'org_A', ${learner}, ${value})
      ON CONFLICT (track_id, clerk_user_id) DO UPDATE
      SET highest_unlocked_position = GREATEST(simulator_track_progress.highest_unlocked_position, excluded.highest_unlocked_position),
          updated_at = excluded.updated_at
    `;
  }

  it('THE FIX: applying a HIGHER frontier then a stale LOWER frontier via the GREATEST upsert leaves the row at the HIGHER value (no regression)', async () => {
    const learner = 'user_fix';
    const idHigh = 'a0000000-0000-0000-0000-000000000044';
    const idStale = 'a0000000-0000-0000-0000-000000000045';

    // Higher frontier applied first.
    await asTenant('org_A', (tx) => upsertAdvance(tx, idHigh, learner, 5));

    // Stale, lower frontier applied AFTER — the exact race scenario the
    // GUARD test above proved regresses under a blind UPDATE.
    await asTenant('org_A', (tx) => upsertAdvance(tx, idStale, learner, 3));

    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id, highest_unlocked_position FROM simulator_track_progress WHERE track_id = ${TRACK_ID} AND clerk_user_id = ${learner}`,
    );
    expect(rows).toHaveLength(1);
    // NO regression — GREATEST(5, 3) = 5, regardless of write order.
    expect(rows[0]?.['highest_unlocked_position']).toBe(5);
  });

  it('THE FIX: order-independent — a LOWER frontier applied first, then a HIGHER one, converges to the HIGHER value too', async () => {
    const learner = 'user_fix_reverse_order';
    const idLow = 'a0000000-0000-0000-0000-000000000046';
    const idHigh = 'a0000000-0000-0000-0000-000000000047';

    await asTenant('org_A', (tx) => upsertAdvance(tx, idLow, learner, 2));
    await asTenant('org_A', (tx) => upsertAdvance(tx, idHigh, learner, 4));

    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT highest_unlocked_position FROM simulator_track_progress WHERE track_id = ${TRACK_ID} AND clerk_user_id = ${learner}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['highest_unlocked_position']).toBe(4);
  });

  it('THE FIX: concurrent/repeated upserts for the same (track, learner) converge to the MAX, exactly one row, no duplicate-key error', async () => {
    const learner = 'user_fix_concurrent';
    const values = [2, 6, 4, 1, 5, 3];
    const ids = [
      'a0000000-0000-0000-0000-000000000050',
      'a0000000-0000-0000-0000-000000000051',
      'a0000000-0000-0000-0000-000000000052',
      'a0000000-0000-0000-0000-000000000053',
      'a0000000-0000-0000-0000-000000000054',
      'a0000000-0000-0000-0000-000000000055',
    ];

    // All fired concurrently — proves ON CONFLICT DO UPDATE serializes
    // safely at the DB level with zero unique-violation errors surfacing,
    // unlike the old create/update/23505-recovery dance.
    await Promise.all(
      values.map((value, i) =>
        asTenant('org_A', (tx) => upsertAdvance(tx, ids[i]!, learner, value)),
      ),
    );

    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT highest_unlocked_position FROM simulator_track_progress WHERE track_id = ${TRACK_ID} AND clerk_user_id = ${learner}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['highest_unlocked_position']).toBe(Math.max(...values));
  });
});
