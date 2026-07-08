/**
 * RLS isolation integration tests — `simulator_track_steps`.
 *
 * Mirrors simulators-isolation.spec.ts / questions-isolation.spec.ts, proving
 * the same properties for the NEW simulator_track_steps table introduced in
 * the gamified-simulators change (Phase 1 — additive delta):
 *
 *   Cross-tenant read: org_A context cannot see org_B's step.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   DB-enforced constraints: unique(simulator_id) — a simulator belongs to
 *     at most one track (design.md, fixed decision) — and
 *     unique(track_id, position) — no two steps share a position.
 *   FORCE ROW LEVEL SECURITY + tenant_isolation policy present (this is a
 *     NEW forced table — the manual tail in 0010 is LOAD-BEARING, not a
 *     defensive re-assert).
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *
 * Seed (from global-setup):
 *   org_A: track a0000000-...-0010 → step a0000000-...-0011 (simulator a...00d, position 1)
 *   org_B: track b0000000-...-0010 → step b0000000-...-0011 (simulator b...00d, position 1)
 *
 * All queries run through appUserClient (NOSUPERUSER, NOBYPASSRLS) so RLS
 * is always evaluated. Superuser access is only used for the negative-gate
 * DDL and cleanup.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appUserClient, asTenant, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

// ---------------------------------------------------------------------------
// Cross-tenant read isolation
// ---------------------------------------------------------------------------

describe('simulator_track_steps isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own step', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT academy_id FROM simulator_track_steps`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B step', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM simulator_track_steps WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded position for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT position FROM simulator_track_steps WHERE id = 'a0000000-0000-0000-0000-000000000011'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['position']).toBe(1);
  });

  it('blocks cross-tenant read of the org_B step row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM simulator_track_steps WHERE id = 'b0000000-0000-0000-0000-000000000011'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('simulator_track_steps isolation — deny-by-default', () => {
  it('returns 0 rows from simulator_track_steps when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM simulator_track_steps`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('simulator_track_steps isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B step while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO simulator_track_steps (track_id, academy_id, simulator_id, position)
          VALUES (
            'b0000000-0000-0000-0000-000000000010',
            'org_B',
            'b0000000-0000-0000-0000-00000000000d',
            99
          )
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// DB-enforced constraints
// ---------------------------------------------------------------------------

describe('simulator_track_steps — DB-enforced constraints', () => {
  it('rejects a second step for a simulator already assigned to a track (unique simulator_id)', async () => {
    await expect(
      asTenant(
        'org_A',
        (tx) =>
          tx`
            INSERT INTO simulator_track_steps (track_id, academy_id, simulator_id, position)
            VALUES (
              'a0000000-0000-0000-0000-000000000010',
              'org_A',
              'a0000000-0000-0000-0000-00000000000d',
              2
            )
          `,
      ),
    ).rejects.toThrow();
  });

  it('rejects a second step at the same position within a track (unique track_id+position)', async () => {
    const simulatorId = 'a0000000-0000-0000-0000-0000000000f5';

    await superuserClient`
      INSERT INTO simulators (id, academy_id, bank_id, title, question_count, time_limit_minutes, status)
      VALUES (${simulatorId}, 'org_A', 'a0000000-0000-0000-0000-00000000000b', 'Step Position Test Sim', 1, 10, 'published')
    `;

    await expect(
      asTenant(
        'org_A',
        (tx) =>
          tx`
            INSERT INTO simulator_track_steps (track_id, academy_id, simulator_id, position)
            VALUES (
              'a0000000-0000-0000-0000-000000000010',
              'org_A',
              ${simulatorId},
              1
            )
          `,
      ),
    ).rejects.toThrow();

    await superuserClient`DELETE FROM simulators WHERE id = ${simulatorId}`;
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('simulator_track_steps isolation — FORCE RLS + policy present', () => {
  it('simulator_track_steps has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'simulator_track_steps'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on simulator_track_steps', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'simulator_track_steps' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('simulator_track_steps isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE simulator_track_steps DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE simulator_track_steps ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE simulator_track_steps FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM simulator_track_steps WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
