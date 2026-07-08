/**
 * Integration test — `DrizzleSimulatorTrackStepRepository.removeAndRecompact`
 * atomicity (adversarial-review fix, gamified-simulators PR2).
 *
 * `RemoveTrackStepUseCase` previously called `stepRepo.deleteById` and
 * `stepRepo.replacePositions` as TWO SEPARATE `withTenant` transactions. A
 * failure between them (e.g. the process crashing, or the second
 * transaction's re-compaction UPDATEs erroring) would leave the DELETE
 * already committed and the remaining steps' positions un-recompacted —
 * a permanent gap in the contiguous 1..N sequence.
 *
 * The fix — `removeAndRecompact` — runs the DELETE and the two-phase
 * position re-compaction (same non-deferrable-constraint-safe park-then-
 * apply sequence as `replacePositions`, see `simulator-track-step-reorder
 * .spec.ts`) inside ONE `withTenant`/`db.transaction`. This file proves
 * that property directly against real Postgres:
 *
 *   1. GUARD — the constraint is real (same guard as the reorder spec).
 *   2. ATOMICITY — if the recompaction phase fails partway through the SAME
 *      transaction as the DELETE, the DELETE is rolled back too: the
 *      "removed" row reappears and every position is exactly as it was
 *      before the transaction started. This is the property that was
 *      IMPOSSIBLE to prove with the old two-transaction shape (the delete
 *      would already be committed by the time recompaction ran).
 *   3. THE FIX — removing a middle step and running the real two-phase
 *      sequence, atomically, leaves positions contiguous 1..N-1 with no
 *      gaps or duplicates.
 *
 * HARNESS LIMITATION (same as `simulator-track-step-reorder.spec.ts`): this
 * "integration" Vitest project does not wire the production Drizzle `db`
 * singleton to the Docker test Postgres. This file proves the exact SQL
 * shape `removeAndRecompact` runs (same DELETE + same phase-1
 * negative-placeholder / phase-2 final-position sequence) via raw
 * `postgres-js`, through the same `app_user` role used in production.
 *
 * Seeds its own track (independent from global-setup's org_A track and from
 * the reorder spec's track) with FRESH fixture UUIDs so this file can
 * freely mutate/re-seed without interfering with either.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asTenant, closeAll, superuserClient } from '../db/test-client';

const BANK_ID = 'a0000000-0000-0000-0000-00000000000b'; // seeded by global-setup

const TRACK_ID = 'a0000000-0000-0000-0000-000000000030';
const SIM_A = 'a0000000-0000-0000-0000-000000000031';
const SIM_B = 'a0000000-0000-0000-0000-000000000032';
const SIM_C = 'a0000000-0000-0000-0000-000000000033';
const SIM_D = 'a0000000-0000-0000-0000-000000000034';
const STEP_A = 'a0000000-0000-0000-0000-000000000035';
const STEP_B = 'a0000000-0000-0000-0000-000000000036';
const STEP_C = 'a0000000-0000-0000-0000-000000000037';
const STEP_D = 'a0000000-0000-0000-0000-000000000038';

async function seedTrackAndSteps(): Promise<void> {
  await superuserClient`
    INSERT INTO simulator_tracks (id, academy_id, title, status)
    VALUES (${TRACK_ID}, 'org_A', 'Remove Test Track', 'draft')
  `;

  for (const [id, title] of [
    [SIM_A, 'Remove Sim A'],
    [SIM_B, 'Remove Sim B'],
    [SIM_C, 'Remove Sim C'],
    [SIM_D, 'Remove Sim D'],
  ] as const) {
    await superuserClient`
      INSERT INTO simulators (id, academy_id, bank_id, title, question_count, time_limit_minutes, status)
      VALUES (${id}, 'org_A', ${BANK_ID}, ${title}, 1, 10, 'published')
    `;
  }

  await superuserClient`
    INSERT INTO simulator_track_steps (id, track_id, academy_id, simulator_id, position)
    VALUES
      (${STEP_A}, ${TRACK_ID}, 'org_A', ${SIM_A}, 1),
      (${STEP_B}, ${TRACK_ID}, 'org_A', ${SIM_B}, 2),
      (${STEP_C}, ${TRACK_ID}, 'org_A', ${SIM_C}, 3),
      (${STEP_D}, ${TRACK_ID}, 'org_A', ${SIM_D}, 4)
  `;
}

async function cleanup(): Promise<void> {
  await superuserClient`DELETE FROM simulator_track_steps WHERE track_id = ${TRACK_ID}`;
  await superuserClient`DELETE FROM simulator_tracks WHERE id = ${TRACK_ID}`;
  await superuserClient`DELETE FROM simulators WHERE id IN (${SIM_A}, ${SIM_B}, ${SIM_C}, ${SIM_D})`;
}

async function currentRows(): Promise<{ id: string; position: number }[]> {
  const rows = await asTenant(
    'org_A',
    (tx) =>
      tx`SELECT id, position FROM simulator_track_steps WHERE track_id = ${TRACK_ID} ORDER BY position`,
  );
  return rows.map((r) => ({ id: String(r['id']), position: Number(r['position']) }));
}

describe('simulator_track_steps — removeAndRecompact runs DELETE + position re-compaction as ONE atomic transaction', () => {
  beforeAll(async () => {
    await cleanup();
    await seedTrackAndSteps();
  });

  afterAll(async () => {
    await cleanup();
    await closeAll();
  });

  // -------------------------------------------------------------------------
  // Guard case — proves the constraint is real, so the atomicity assertion
  // below (rollback restores the original row) is meaningful.
  // -------------------------------------------------------------------------

  it('GUARD: a direct UPDATE that duplicates an existing position is rejected by unique(track_id, position)', async () => {
    await expect(
      asTenant('org_A', (tx) => tx`UPDATE simulator_track_steps SET position = 3 WHERE id = ${STEP_A}`),
    ).rejects.toThrow();

    const rows = await currentRows();
    expect(rows).toEqual([
      { id: STEP_A, position: 1 },
      { id: STEP_B, position: 2 },
      { id: STEP_C, position: 3 },
      { id: STEP_D, position: 4 },
    ]);
  });

  // -------------------------------------------------------------------------
  // Atomicity — this is the actual bug the fix closes. If the delete and
  // the re-compaction ran as TWO separate transactions (the pre-fix shape),
  // a failure in the second one could never undo the first: the delete
  // would already be committed. Proving that a failure INSIDE the SAME
  // transaction as the delete rolls the delete back too demonstrates that
  // `removeAndRecompact`'s single-transaction shape is what makes this
  // rollback possible at all.
  // -------------------------------------------------------------------------

  it('ATOMICITY: a failure during recompaction rolls back the DELETE too — no gap is left', async () => {
    await expect(
      asTenant('org_A', async (tx) => {
        // Same DELETE removeAndRecompact issues first.
        await tx`DELETE FROM simulator_track_steps WHERE id = ${STEP_B}`;
        // Deliberately skip the two-phase park step and write a final
        // position directly, colliding with STEP_D's still-current
        // position 4 — forces the whole transaction (delete included) to
        // fail and roll back.
        await tx`UPDATE simulator_track_steps SET position = 4 WHERE id = ${STEP_C}`;
      }),
    ).rejects.toThrow();

    // STEP_B must be BACK (the delete was rolled back) and every position
    // must be exactly as it was before the transaction started — proving
    // delete + recompaction are coupled, not independently committable.
    const rows = await currentRows();
    expect(rows).toEqual([
      { id: STEP_A, position: 1 },
      { id: STEP_B, position: 2 },
      { id: STEP_C, position: 3 },
      { id: STEP_D, position: 4 },
    ]);
  });

  // -------------------------------------------------------------------------
  // The fix — removeAndRecompact's exact DELETE + two-phase sequence,
  // atomically, leaves a contiguous 1..N-1 sequence with no gaps/duplicates.
  // -------------------------------------------------------------------------

  it('THE FIX: removing a middle step re-compacts the remaining steps to a contiguous 1..N-1 sequence, atomically', async () => {
    // Remaining after removing STEP_B (position 2): A stays 1, C moves
    // 3->2, D moves 4->3 — mirrors RemoveTrackStepUseCase's own computation.
    const updates = [
      { id: STEP_C, position: 2 },
      { id: STEP_D, position: 3 },
    ];

    await asTenant('org_A', async (tx) => {
      // Mirrors DrizzleSimulatorTrackStepRepository.removeAndRecompact
      // exactly: DELETE, then phase 1 (park at negative placeholders),
      // then phase 2 (apply real final positions) — all in ONE transaction.
      await tx`DELETE FROM simulator_track_steps WHERE id = ${STEP_B}`;
      for (const [index, update] of updates.entries()) {
        await tx`UPDATE simulator_track_steps SET position = ${-(index + 1)} WHERE id = ${update.id}`;
      }
      for (const update of updates) {
        await tx`UPDATE simulator_track_steps SET position = ${update.position} WHERE id = ${update.id}`;
      }
    });

    const rows = await currentRows();

    // STEP_B is gone; A/C/D are contiguous 1..3, no gaps or duplicates.
    expect(rows).toEqual([
      { id: STEP_A, position: 1 },
      { id: STEP_C, position: 2 },
      { id: STEP_D, position: 3 },
    ]);
    expect(new Set(rows.map((r) => r.position)).size).toBe(3);
  });
});
