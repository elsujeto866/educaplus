/**
 * RLS isolation integration tests.
 *
 * Proves four properties of the RLS configuration:
 *
 *   7.1  Same-tenant read: app_user in org_A context sees only org_A rows.
 *        Cross-tenant read: WHERE academy_id = 'org_B' returns 0 rows.
 *
 *   7.2  No context (no set_config call at all): deny-by-default — 0 rows
 *        returned from both tables, even though rows exist for both orgs.
 *
 *   7.3  Cross-tenant write: INSERT with academy_id = 'org_B' while
 *        app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *
 *   7.4  Negative gate: DROP POLICY on memberships → isolation assertion FAILS
 *        (rows leak through) → it.fails() marks that test as PASSING, proving
 *        the positive tests are not vacuously green.
 *        Policy is restored in afterAll so it does not affect other runs.
 *
 * Seed (from global-setup):
 *   academies:   org_A (Academy A), org_B (Academy B)
 *   memberships: (org_A, user_A1, admin), (org_B, user_B1, student)
 *
 * All queries run through appUserClient (NOSUPERUSER, NOBYPASSRLS) so RLS
 * is always evaluated. Superuser access is only used for the negative-gate
 * policy drop/restore.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appUserClient, asTenant, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

// ---------------------------------------------------------------------------
// 7.1  Tenant isolation — same-tenant read allowed, cross-tenant read blocked
// ---------------------------------------------------------------------------

describe('7.1 tenant read isolation (academies)', () => {
  it('allows same-tenant read: org_A context sees org_A academy', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT id FROM academies`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('org_A');
  });

  it('blocks cross-tenant read: org_A context cannot see org_B academy', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM academies WHERE id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('7.1 tenant read isolation (memberships)', () => {
  it('allows same-tenant read: org_A context sees only org_A memberships', async () => {
    const rows =
      await asTenant('org_A', (tx) => tx`SELECT academy_id FROM memberships`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // postgres-js rows are Record<string, unknown>; cast for readable assertion.
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context returns 0 rows for org_B memberships', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM memberships WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7.2  No context — deny-by-default
// ---------------------------------------------------------------------------

describe('7.2 deny-by-default (no tenant context set)', () => {
  it('returns 0 rows from academies when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM academies`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from memberships when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM memberships`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7.3  Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('7.3 cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT into org_B memberships while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO memberships (academy_id, clerk_user_id, role)
          VALUES ('org_B', 'rogue_user', 'student')
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects INSERT into org_B academies while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO academies (id, name, slug)
          VALUES ('org_B_evil', 'Evil Clone', 'evil-clone')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7.4  Negative gate — proves isolation tests are not vacuously passing
//
// Key insight: dropping the tenant_isolation POLICY on a table that still has
// ENABLE ROW LEVEL SECURITY does NOT make rows leak — it makes things MORE
// restrictive (deny-all, no permissive policy left). To prove that the isolation
// test is not vacuously passing (returning 0 for the wrong reason), we must
// DISABLE ROW LEVEL SECURITY entirely so rows actually leak through.
//
// Steps:
//   beforeAll  — DISABLE ROW LEVEL SECURITY on memberships (superuser DDL)
//   it.fails   — same cross-tenant read that normally returns 0 → now returns
//                org_B's row → toHaveLength(0) FAILS → it.fails() PASSES
//   afterAll   — re-ENABLE + re-FORCE ROW LEVEL SECURITY (restore for reuse)
// ---------------------------------------------------------------------------

describe('7.4 negative gate — RLS enforcement is not vacuous', () => {
  beforeAll(async () => {
    // Disabling RLS lets all rows through, proving that the isolation test
    // returns 0 BECAUSE of RLS, not by coincidence.
    await superuserClient`ALTER TABLE memberships DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    // Restore full RLS enforcement so the container can be reused.
    await superuserClient`ALTER TABLE memberships ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE memberships FORCE ROW LEVEL SECURITY`;
  });

  /**
   * This test MUST FAIL: with RLS disabled, org_A context leaks org_B rows,
   * so expect(rows).toHaveLength(0) throws an AssertionError.
   * it.fails() wraps the test and PASSES precisely because it failed,
   * proving the positive isolation tests (7.1-7.3) are real, not vacuous.
   */
  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM memberships WHERE academy_id = 'org_B'`,
      );
      // RLS disabled: org_B row is visible → rows.length === 1 → FAILS here.
      expect(rows).toHaveLength(0);
    },
  );
});
