/**
 * RLS isolation integration tests — `questions`.
 *
 * Mirrors question-banks-isolation.spec.ts, proving the same properties for
 * the NEW questions table introduced in the exam-simulator-question-bank
 * change (Slice S1a):
 *
 *   Cross-tenant read: org_A context cannot see org_B's question.
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
 *   org_A: bank a0000000-...-00b → question a0000000-...-00c (topic 'algebra')
 *   org_B: bank b0000000-...-00b → question b0000000-...-00c (topic 'algebra')
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

describe('questions isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own question', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM questions`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B question', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM questions WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded prompt/topic for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT prompt, topic FROM questions WHERE id = 'a0000000-0000-0000-0000-00000000000c'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['topic']).toBe('algebra');
  });

  it('blocks cross-tenant read of the org_B question row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM questions WHERE id = 'b0000000-0000-0000-0000-00000000000c'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('questions isolation — deny-by-default', () => {
  it('returns 0 rows from questions when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM questions`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('questions isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B question while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO questions (bank_id, academy_id, prompt, options, correct_option_id)
          VALUES ('b0000000-0000-0000-0000-00000000000b', 'org_B', 'Evil?', '[]', 'x')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('questions isolation — FORCE RLS + policy present', () => {
  it('questions has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'questions'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on questions', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'questions' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('questions isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE questions DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE questions ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE questions FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM questions WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
