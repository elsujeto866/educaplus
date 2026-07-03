/**
 * RLS isolation integration tests — `question_banks`.
 *
 * Mirrors attempt-isolation.spec.ts / certificate-isolation.spec.ts, proving
 * the same properties for the NEW question_banks table introduced in the
 * exam-simulator-question-bank change (Slice S1a):
 *
 *   Cross-tenant read: org_A context cannot see org_B's bank.
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
 *   org_A: question_bank a0000000-...-00b (title "Bank A1")
 *   org_B: question_bank b0000000-...-00b (title "Bank B1")
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

describe('question_banks isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own bank', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM question_banks`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B bank', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM question_banks WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded title for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT title FROM question_banks WHERE id = 'a0000000-0000-0000-0000-00000000000b'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['title']).toBe('Bank A1');
  });

  it('blocks cross-tenant read of the org_B bank row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM question_banks WHERE id = 'b0000000-0000-0000-0000-00000000000b'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('question_banks isolation — deny-by-default', () => {
  it('returns 0 rows from question_banks when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM question_banks`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('question_banks isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B bank while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO question_banks (academy_id, title)
          VALUES ('org_B', 'Evil Bank')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('question_banks isolation — FORCE RLS + policy present', () => {
  it('question_banks has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'question_banks'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on question_banks', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'question_banks' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('question_banks isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE question_banks DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE question_banks FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM question_banks WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
