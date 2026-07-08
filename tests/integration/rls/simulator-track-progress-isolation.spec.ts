/**
 * RLS isolation integration tests — `simulator_track_progress`.
 *
 * Mirrors simulator-certificates-isolation.spec.ts, proving the same
 * properties for the NEW simulator_track_progress table introduced in the
 * gamified-simulators change (Phase 1 — additive delta):
 *
 *   Cross-tenant read: org_A context cannot see org_B's progress row.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   DB-enforced constraint: unique(track_id, clerk_user_id) — one progress
 *     row per (track, learner); the race-safe re-read/re-apply recovery in
 *     AdvanceProgressOnPassUseCase (Phase 3) relies on this holding at the
 *     DB level, not just app-level convention.
 *   FORCE ROW LEVEL SECURITY + tenant_isolation policy present (this is a
 *     NEW forced table — the manual tail in 0010 is LOAD-BEARING, not a
 *     defensive re-assert).
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *
 * Seed (from global-setup):
 *   org_A: track a0000000-...-0010 → progress a0000000-...-0012 (user_A1, frontier 1)
 *   org_B: track b0000000-...-0010 → progress b0000000-...-0012 (user_B1, frontier 1)
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

describe('simulator_track_progress isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own progress row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT academy_id FROM simulator_track_progress`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B progress row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM simulator_track_progress WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded frontier for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT highest_unlocked_position FROM simulator_track_progress WHERE id = 'a0000000-0000-0000-0000-000000000012'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['highest_unlocked_position']).toBe(1);
  });

  it('blocks cross-tenant read of the org_B progress row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM simulator_track_progress WHERE id = 'b0000000-0000-0000-0000-000000000012'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('simulator_track_progress isolation — deny-by-default', () => {
  it('returns 0 rows from simulator_track_progress when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM simulator_track_progress`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('simulator_track_progress isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B progress row while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO simulator_track_progress (track_id, academy_id, clerk_user_id, highest_unlocked_position)
          VALUES (
            'b0000000-0000-0000-0000-000000000010',
            'org_B',
            'user_evil',
            1
          )
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// DB-enforced constraint — one progress row per (track, learner)
// ---------------------------------------------------------------------------

describe('simulator_track_progress — DB-enforced constraint', () => {
  it('rejects a second progress row for the same (track_id, clerk_user_id) pair', async () => {
    await expect(
      asTenant(
        'org_A',
        (tx) =>
          tx`
            INSERT INTO simulator_track_progress (track_id, academy_id, clerk_user_id, highest_unlocked_position)
            VALUES (
              'a0000000-0000-0000-0000-000000000010',
              'org_A',
              'user_A1',
              2
            )
          `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('simulator_track_progress isolation — FORCE RLS + policy present', () => {
  it('simulator_track_progress has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'simulator_track_progress'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on simulator_track_progress', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'simulator_track_progress' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('simulator_track_progress isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE simulator_track_progress DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE simulator_track_progress ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE simulator_track_progress FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM simulator_track_progress WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
