/**
 * Integration test — `DrizzleSimulatorTrackStepRepository.replacePositions`'s
 * two-phase write (gamified-simulators change, Phase 1 — additive delta).
 *
 * `simulator_track_steps` carries `unique(track_id, position)` with NO
 * `deferrable` clause (see `simulator.schema.ts`), so Postgres checks it
 * immediately after EACH statement, not at COMMIT. Applying a reorder as a
 * naive single-pass "one UPDATE per row, final position directly" sequence
 * can therefore collide mid-transaction whenever a target position is
 * currently held by another row that hasn't been updated yet (e.g. swapping
 * the first and last step of a track). `replacePositions` avoids this by
 * parking every touched row at a unique negative placeholder position first
 * (phase 1), then applying the real final positions once all touched rows
 * are safely out of the way (phase 2).
 *
 * This property is proven ONLY by mocked unit tests today (which stub the
 * Drizzle `tx` and never touch a real `unique` constraint) — this file
 * exercises the exact SQL shape against real Postgres.
 *
 * HARNESS LIMITATION (same as `attempt-limit-concurrency.spec.ts`): this
 * "integration" Vitest project does not wire the production Drizzle `db`
 * singleton (which requires `DATABASE_URL`/Clerk env vars via
 * `@/config/env`) to the Docker test Postgres. Every file in this directory
 * proves DB-level behavior with raw SQL through `postgres-js` directly,
 * never through the compiled repository classes. This test follows the same
 * convention: the "fix" scenario below issues the IDENTICAL statement
 * sequence `replacePositions` runs (same phase-1 negative-placeholder
 * derivation `-(index + 1)`, same phase-2 final UPDATE), against the SAME
 * `simulator_track_steps` table via the SAME `app_user` role used in
 * production.
 *
 * Seeds its own track (independent from global-setup's org_A track) with 4
 * steps at positions 1..4 so this file can freely mutate/re-seed without
 * interfering with `simulator-track-steps-isolation.spec.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asTenant, closeAll, superuserClient } from '../db/test-client';

// Dedicated, unlikely-to-collide fixture IDs — org_A tenant only.
const BANK_ID = 'a0000000-0000-0000-0000-00000000000b'; // seeded by global-setup
const TRACK_ID = 'a0000000-0000-0000-0000-000000000020';
const SIM_A = 'a0000000-0000-0000-0000-000000000021';
const SIM_B = 'a0000000-0000-0000-0000-000000000022';
const SIM_C = 'a0000000-0000-0000-0000-000000000023';
const SIM_D = 'a0000000-0000-0000-0000-000000000024';
const STEP_A = 'a0000000-0000-0000-0000-000000000025';
const STEP_B = 'a0000000-0000-0000-0000-000000000026';
const STEP_C = 'a0000000-0000-0000-0000-000000000027';
const STEP_D = 'a0000000-0000-0000-0000-000000000028';

async function seedTrackAndSteps(): Promise<void> {
  await superuserClient`
    INSERT INTO simulator_tracks (id, academy_id, title, status)
    VALUES (${TRACK_ID}, 'org_A', 'Reorder Test Track', 'draft')
  `;

  for (const [id, title] of [
    [SIM_A, 'Reorder Sim A'],
    [SIM_B, 'Reorder Sim B'],
    [SIM_C, 'Reorder Sim C'],
    [SIM_D, 'Reorder Sim D'],
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

describe('simulator_track_steps — replacePositions two-phase write survives the non-deferrable unique(track_id, position) constraint', () => {
  beforeAll(async () => {
    await cleanup();
    await seedTrackAndSteps();
  });

  afterAll(async () => {
    await cleanup();
    await closeAll();
  });

  // -------------------------------------------------------------------------
  // Guard case — proves the constraint is real, so the "fix" success below
  // is meaningful and not vacuously green.
  // -------------------------------------------------------------------------

  it('GUARD: a direct UPDATE that duplicates an existing position is rejected by unique(track_id, position)', async () => {
    await expect(
      asTenant(
        'org_A',
        (tx) => tx`UPDATE simulator_track_steps SET position = 2 WHERE id = ${STEP_A}`,
      ),
    ).rejects.toThrow();

    // The failed statement must not have left step A's position mutated.
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT position FROM simulator_track_steps WHERE id = ${STEP_A}`,
    );
    expect(rows[0]?.['position']).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Naive single-pass reorder — the pre-fix shape — collides mid-transaction.
  // -------------------------------------------------------------------------

  it('DOCUMENTS THE BUG the two-phase write avoids: a naive single-pass UPDATE-to-final-position sequence collides on a first↔last swap', async () => {
    // Reverse permutation: A(1)->4, B(2)->3, C(3)->2, D(4)->1. Applying these
    // as direct UPDATEs, in this order, hits the very first statement: A's
    // target position 4 is still held by D (untouched at this point).
    await expect(
      asTenant('org_A', async (tx) => {
        const updates = [
          { id: STEP_A, position: 4 },
          { id: STEP_B, position: 3 },
          { id: STEP_C, position: 2 },
          { id: STEP_D, position: 1 },
        ];
        for (const update of updates) {
          await tx`UPDATE simulator_track_steps SET position = ${update.position} WHERE id = ${update.id}`;
        }
      }),
    ).rejects.toThrow();

    // Rolled back — original positions untouched.
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id, position FROM simulator_track_steps WHERE track_id = ${TRACK_ID} ORDER BY position`,
    );
    expect(rows.map((r) => [r['id'], r['position']])).toEqual([
      [STEP_A, 1],
      [STEP_B, 2],
      [STEP_C, 3],
      [STEP_D, 4],
    ]);
  });

  // -------------------------------------------------------------------------
  // The fix — replacePositions' exact two-phase sequence.
  // -------------------------------------------------------------------------

  it('THE FIX: the two-phase park-then-apply sequence survives a reverse permutation (first<->last swap + adjacent B<->C swap)', async () => {
    const updates = [
      { id: STEP_A, position: 4 },
      { id: STEP_B, position: 3 },
      { id: STEP_C, position: 2 },
      { id: STEP_D, position: 1 },
    ];

    await asTenant('org_A', async (tx) => {
      // Phase 1 — mirrors DrizzleSimulatorTrackStepRepository.replacePositions
      // exactly: park every touched row at a unique negative placeholder.
      for (const [index, update] of updates.entries()) {
        await tx`UPDATE simulator_track_steps SET position = ${-(index + 1)} WHERE id = ${update.id}`;
      }
      // Phase 2 — apply the real final positions; all targets are vacated.
      for (const update of updates) {
        await tx`UPDATE simulator_track_steps SET position = ${update.position} WHERE id = ${update.id}`;
      }
    });

    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id, position FROM simulator_track_steps WHERE track_id = ${TRACK_ID} ORDER BY position`,
    );

    // Exactly the requested permutation, contiguous 1..4, no duplicates.
    expect(rows.map((r) => [r['id'], r['position']])).toEqual([
      [STEP_D, 1],
      [STEP_C, 2],
      [STEP_B, 3],
      [STEP_A, 4],
    ]);
    expect(new Set(rows.map((r) => r['position'])).size).toBe(4);
  });
});
