/**
 * RLS isolation integration tests — `simulator_certificates` (issued
 * proof-of-pass credential, Slice S5).
 *
 * Mirrors certificate-isolation.spec.ts / simulator-attempts-isolation.spec.ts,
 * proving the same properties for the NEW simulator_certificates table:
 *
 *   Cross-tenant read: org_A context cannot see org_B's certificate.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   DB-enforced constraint: unique(simulator_id, clerk_user_id) — passing
 *     twice never inserts a second row at the DB level either.
 *   FORCE ROW LEVEL SECURITY + tenant_isolation policy present (this is a
 *     NEW forced table — the manual tail in 0008 is LOAD-BEARING, not a
 *     defensive re-assert).
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *
 * Seed (from global-setup):
 *   org_A: simulator a0000000-...-00d → certificate a0000000-...-00f (score=100)
 *   org_B: simulator b0000000-...-00d → certificate b0000000-...-00f (score=100)
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

describe('simulator_certificates isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own certificate', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM simulator_certificates`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B certificate', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM simulator_certificates WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads the seeded score/certificate_code for its own tenant only', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT score, certificate_code FROM simulator_certificates WHERE id = 'a0000000-0000-0000-0000-00000000000f'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['score']).toBe(100);
    expect(rows[0]?.['certificate_code']).toBe('CERT-2026-SIMAAAA1');
  });

  it('blocks cross-tenant read of the org_B certificate row', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT id FROM simulator_certificates WHERE id = 'b0000000-0000-0000-0000-00000000000f'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('simulator_certificates isolation — deny-by-default', () => {
  it('returns 0 rows from simulator_certificates when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM simulator_certificates`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('simulator_certificates isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B certificate while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO simulator_certificates
            (simulator_id, academy_id, clerk_user_id, certificate_code, score, student_name, simulator_title, academy_name)
          VALUES
            ('b0000000-0000-0000-0000-00000000000d', 'org_B', 'user_evil', 'CERT-2026-EVILEVIL', 100, 'Evil', 'Simulator B1', 'Academy B')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// DB-enforced constraint — one certificate per (simulator_id, clerk_user_id)
//
// Exercises the raw DB constraint directly (bypassing the app's
// findBySimulatorAndUser-then-create idempotent flow), proving the
// simulator_certificates_simulator_id_clerk_user_id_unique constraint
// actually holds at the database level — this is what makes "passing twice
// never re-issues" true even under a race, not just app-level convention.
// A dedicated simulator is created (and cleaned up) per test so the shared
// seed data used by other specs is left untouched.
// ---------------------------------------------------------------------------

describe('simulator_certificates — DB-enforced constraint', () => {
  it('rejects a second certificate insert for the same (simulator_id, clerk_user_id) pair', async () => {
    const simulatorId = 'a0000000-0000-0000-0000-0000000000f4';

    // Setup (simulator + first certificate) commits in its own transaction
    // so the expected-failure INSERT below runs against already-committed rows.
    await asTenant('org_A', async (tx) => {
      await tx`
        INSERT INTO simulators (id, academy_id, bank_id, title, question_count, passing_score, time_limit_minutes, attempt_limit, status)
        VALUES (${simulatorId}, 'org_A', 'a0000000-0000-0000-0000-00000000000b', 'Simulator Cert Unique Test', 1, 70, 30, 3, 'published')
      `;
      await tx`
        INSERT INTO simulator_certificates (simulator_id, academy_id, clerk_user_id, certificate_code, score, student_name, simulator_title, academy_name)
        VALUES (${simulatorId}, 'org_A', 'user_A1', 'CERT-2026-FIRST111', 90, 'Student A1', 'Simulator Cert Unique Test', 'Academy A')
      `;
    });

    // A failed statement aborts the surrounding transaction, so this must be
    // its own asTenant() call — letting the rejection propagate lets
    // postgres-js roll it back cleanly.
    await expect(
      asTenant(
        'org_A',
        (tx) =>
          tx`
            INSERT INTO simulator_certificates (simulator_id, academy_id, clerk_user_id, certificate_code, score, student_name, simulator_title, academy_name)
            VALUES (${simulatorId}, 'org_A', 'user_A1', 'CERT-2026-SECOND22', 100, 'Student A1', 'Simulator Cert Unique Test', 'Academy A')
          `,
      ),
    ).rejects.toThrow();

    // Cleanup — cascades to the (single) certificate row created above.
    await superuserClient`DELETE FROM simulators WHERE id = ${simulatorId}`;
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy present (this is a NEW forced table)
// ---------------------------------------------------------------------------

describe('simulator_certificates isolation — FORCE RLS + policy present', () => {
  it('simulator_certificates has FORCE ROW LEVEL SECURITY', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'simulator_certificates'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is active on simulator_certificates', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'simulator_certificates' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('simulator_certificates isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE simulator_certificates DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE simulator_certificates ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE simulator_certificates FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM simulator_certificates WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
