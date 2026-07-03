/**
 * RLS isolation integration tests — `simulator_attempts`.
 *
 * Mirrors simulators-isolation.spec.ts / attempt-isolation.spec.ts, proving
 * the same properties for the NEW simulator_attempts table introduced in the
 * exam-simulator-question-bank change (Slice S1a):
 *
 *   Cross-tenant read: org_A context cannot see org_B's attempt.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   FORCE ROW LEVEL SECURITY + tenant_isolation policy present (this is a
 *     NEW forced table — the manual tail in 0007 is LOAD-BEARING, not a
 *     defensive re-assert).
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *   Unlimited retakes: no unique constraint on (simulator_id, clerk_user_id)
 *     at the DB level (attempt-limit is enforced at the use-case level).
 *
 * Seed (from global-setup):
 *   org_A: simulator a0000000-...-00d → attempt a0000000-...-00e (status 'submitted')
 *   org_B: simulator b0000000-...-00d → attempt b0000000-...-00e (status 'submitted')
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

describe('simulator_attempts isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own attempt', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM simulator_attempts`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B attempt', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM simulator_attempts WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded score/passed for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT score, passed FROM simulator_attempts WHERE id = 'a0000000-0000-0000-0000-00000000000e'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['score']).toBe(100);
    expect(rows[0]?.['passed']).toBe(true);
  });

  it('blocks cross-tenant read of the org_B attempt row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM simulator_attempts WHERE id = 'b0000000-0000-0000-0000-00000000000e'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('simulator_attempts isolation — deny-by-default', () => {
  it('returns 0 rows from simulator_attempts when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM simulator_attempts`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('simulator_attempts isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B attempt while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO simulator_attempts
            (simulator_id, academy_id, clerk_user_id, status, frozen_questions, deadline_at)
          VALUES
            ('b0000000-0000-0000-0000-00000000000d', 'org_B', 'user_evil', 'in_progress', '[]', now() + interval '30 minutes')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unlimited retakes — no unique constraint at the DB level
// ---------------------------------------------------------------------------

describe('simulator_attempts — unlimited retakes (no unique constraint)', () => {
  it('allows a second attempt row for the same (simulator_id, clerk_user_id) pair', async () => {
    await asTenant(
      'org_A',
      (tx) => tx`
        INSERT INTO simulator_attempts
          (simulator_id, academy_id, clerk_user_id, status, frozen_questions, deadline_at)
        VALUES
          ('a0000000-0000-0000-0000-00000000000d', 'org_A', 'user_A1', 'in_progress', '[]', now() + interval '30 minutes')
      `,
    );

    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM simulator_attempts WHERE simulator_id = 'a0000000-0000-0000-0000-00000000000d' AND clerk_user_id = 'user_A1'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('simulator_attempts isolation — FORCE RLS + policy present', () => {
  it('simulator_attempts has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'simulator_attempts'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on simulator_attempts', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'simulator_attempts' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('simulator_attempts isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE simulator_attempts DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE simulator_attempts ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE simulator_attempts FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM simulator_attempts WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
