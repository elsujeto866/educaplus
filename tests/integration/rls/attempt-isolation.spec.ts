/**
 * RLS isolation integration tests — `assessment_attempts` (quiz submissions).
 *
 * Mirrors assessment-isolation.spec.ts, proving the same properties for the
 * NEW assessment_attempts table introduced in Slice 4b-i:
 *
 *   Cross-tenant read: org_A context cannot see org_B's attempt.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   FORCE ROW LEVEL SECURITY + tenant_isolation policy present (this is a
 *     NEW forced table — the manual tail in 0005 is LOAD-BEARING, not a
 *     defensive re-assert).
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *
 * Seed (from global-setup):
 *   org_A: assessment a0000000-...-008 → attempt a0000000-...-009 (passed=true)
 *   org_B: assessment b0000000-...-008 → attempt b0000000-...-009 (passed=true)
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

describe('assessment_attempts isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own attempt', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM assessment_attempts`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B attempt', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM assessment_attempts WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded score/passed for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT score, passed FROM assessment_attempts WHERE id = 'a0000000-0000-0000-0000-000000000009'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['score']).toBe(100);
    expect(rows[0]?.['passed']).toBe(true);
  });

  it('blocks cross-tenant read of the org_B attempt row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM assessment_attempts WHERE id = 'b0000000-0000-0000-0000-000000000009'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('assessment_attempts isolation — deny-by-default', () => {
  it('returns 0 rows from assessment_attempts when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM assessment_attempts`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('assessment_attempts isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B attempt while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO assessment_attempts (assessment_id, academy_id, clerk_user_id, answers, score, passed)
          VALUES ('b0000000-0000-0000-0000-000000000008', 'org_B', 'user_evil', '[]', 100, true)
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unlimited retakes — no unique constraint at the DB level
// ---------------------------------------------------------------------------

describe('assessment_attempts — unlimited retakes (no unique constraint)', () => {
  it('allows a second attempt row for the same (assessment_id, clerk_user_id) pair', async () => {
    await asTenant(
      'org_A',
      (tx) => tx`
        INSERT INTO assessment_attempts (assessment_id, academy_id, clerk_user_id, answers, score, passed)
        VALUES ('a0000000-0000-0000-0000-000000000008', 'org_A', 'user_A1', '[]', 50, false)
      `,
    );

    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM assessment_attempts WHERE assessment_id = 'a0000000-0000-0000-0000-000000000008' AND clerk_user_id = 'user_A1'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('assessment_attempts isolation — FORCE RLS + policy present', () => {
  it('assessment_attempts has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'assessment_attempts'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on assessment_attempts', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'assessment_attempts' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('assessment_attempts isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE assessment_attempts DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE assessment_attempts FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM assessment_attempts WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
