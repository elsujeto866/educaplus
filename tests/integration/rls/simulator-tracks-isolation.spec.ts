/**
 * RLS isolation integration tests — `simulator_tracks`.
 *
 * Mirrors simulators-isolation.spec.ts, proving the same properties for the
 * NEW simulator_tracks table introduced in the gamified-simulators change
 * (Phase 1 — additive delta):
 *
 *   Cross-tenant read: org_A context cannot see org_B's track.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   FORCE ROW LEVEL SECURITY + tenant_isolation policy present (this is a
 *     NEW forced table — the manual tail in 0010 is LOAD-BEARING, not a
 *     defensive re-assert).
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *
 * Seed (from global-setup):
 *   org_A: track a0000000-...-0010 (status 'published')
 *   org_B: track b0000000-...-0010 (status 'published')
 *
 * All queries run through appUserClient (NOSUPERUSER, NOBYPASSRLS) so RLS
 * is always evaluated. Superuser access is only used for the negative-gate
 * DDL.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appUserClient, asTenant, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

// ---------------------------------------------------------------------------
// Cross-tenant read isolation
// ---------------------------------------------------------------------------

describe('simulator_tracks isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own track', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM simulator_tracks`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B track', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM simulator_tracks WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded title/status for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT title, status FROM simulator_tracks WHERE id = 'a0000000-0000-0000-0000-000000000010'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['status']).toBe('published');
  });

  it('blocks cross-tenant read of the org_B track row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM simulator_tracks WHERE id = 'b0000000-0000-0000-0000-000000000010'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('simulator_tracks isolation — deny-by-default', () => {
  it('returns 0 rows from simulator_tracks when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM simulator_tracks`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('simulator_tracks isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B track while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO simulator_tracks (academy_id, title)
          VALUES ('org_B', 'Evil Track')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('simulator_tracks isolation — FORCE RLS + policy present', () => {
  it('simulator_tracks has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'simulator_tracks'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on simulator_tracks', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'simulator_tracks' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('simulator_tracks isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE simulator_tracks DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE simulator_tracks ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE simulator_tracks FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM simulator_tracks WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
