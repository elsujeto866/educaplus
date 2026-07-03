/**
 * RLS isolation integration tests — `simulators`.
 *
 * Mirrors questions-isolation.spec.ts, proving the same properties for the
 * NEW simulators table introduced in the exam-simulator-question-bank change
 * (Slice S1a):
 *
 *   Cross-tenant read: org_A context cannot see org_B's simulator.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   FORCE ROW LEVEL SECURITY + tenant_isolation policy present (this is a
 *     NEW forced table — the manual tail in 0007 is LOAD-BEARING, not a
 *     defensive re-assert).
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *
 * Seed (from global-setup):
 *   org_A: bank a0000000-...-00b → simulator a0000000-...-00d (status 'published')
 *   org_B: bank b0000000-...-00b → simulator b0000000-...-00d (status 'published')
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

describe('simulators isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own simulator', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM simulators`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B simulator', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM simulators WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded title/status for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT title, status FROM simulators WHERE id = 'a0000000-0000-0000-0000-00000000000d'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['status']).toBe('published');
  });

  it('blocks cross-tenant read of the org_B simulator row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM simulators WHERE id = 'b0000000-0000-0000-0000-00000000000d'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('simulators isolation — deny-by-default', () => {
  it('returns 0 rows from simulators when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM simulators`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('simulators isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B simulator while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO simulators (academy_id, bank_id, title, question_count, time_limit_minutes)
          VALUES ('org_B', 'b0000000-0000-0000-0000-00000000000b', 'Evil Sim', 10, 30)
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('simulators isolation — FORCE RLS + policy present', () => {
  it('simulators has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'simulators'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on simulators', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'simulators' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('simulators isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE simulators DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE simulators ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE simulators FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM simulators WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
