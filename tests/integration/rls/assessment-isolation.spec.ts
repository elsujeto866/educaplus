/**
 * RLS isolation integration tests — course-scoped `assessments` (final quiz).
 *
 * Slice 3a reshaped `assessments` from per-module opaque config to
 * course-scoped typed JSONB `questions`. This spec proves the same four
 * properties as tenant-isolation.spec.ts / course-isolation.spec.ts, scoped
 * to the reshaped table:
 *
 *   Cross-tenant read: org_A context cannot see org_B's assessment.
 *   Deny-by-default: no tenant context set → 0 rows.
 *   Cross-tenant write: INSERT/upsert with academy_id = 'org_B' while
 *     app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *   Negative gate: DISABLE RLS → isolation assertion FAILS (rows leak
 *     through) → it.fails() marks that test as PASSING, proving the
 *     positive tests are not vacuously green. Restored in afterAll.
 *
 * Seed (from global-setup):
 *   org_A: course a0000000-...-001 → assessment a0000000-...-008 (questions: [])
 *   org_B: course b0000000-...-001 → assessment b0000000-...-008 (questions: [])
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

describe('assessment isolation — tenant read', () => {
  it('allows same-tenant read: org_A context sees its own assessment', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM assessments`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B assessment', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM assessments WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('reads passing_score for its own tenant only (0004 column, seeded org_A=70)', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT passing_score FROM assessments WHERE course_id = 'a0000000-0000-0000-0000-000000000001'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['passing_score']).toBe(70);
  });

  it('blocks cross-tenant read of passing_score: org_A context cannot see org_B value (seeded 80)', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) =>
        tx`SELECT passing_score FROM assessments WHERE course_id = 'b0000000-0000-0000-0000-000000000001'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Deny-by-default — no tenant context set
// ---------------------------------------------------------------------------

describe('assessment isolation — deny-by-default', () => {
  it('returns 0 rows from assessments when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM assessments`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('assessment isolation — cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT of an org_B assessment while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO assessments (course_id, academy_id, title, questions)
          VALUES ('b0000000-0000-0000-0000-000000000001', 'org_B', 'Evil Quiz', '[]')
        `,
      ),
    ).rejects.toThrow();
  });

  it('cross-tenant UPDATE (upsert-replace) affects 0 rows — org_B row is invisible under org_A context', async () => {
    // USING filters the org_B row out of visibility before WITH CHECK is even
    // evaluated, so the UPDATE affects 0 rows rather than throwing — this is
    // the expected RLS semantics for an UPDATE whose WHERE targets a row the
    // current tenant cannot see.
    const result = await asTenant('org_A', (tx) =>
      tx`
        UPDATE assessments
        SET questions = '[{"type":"single","id":"q-evil","prompt":"Evil?","options":[{"id":"o1","label":"Yes"},{"id":"o2","label":"No"}],"correctOptionId":"o1"}]'
        WHERE course_id = 'b0000000-0000-0000-0000-000000000001'
      `,
    );
    expect(result.count).toBe(0);
  });

  it('confirms the cross-tenant UPDATE above did not actually modify org_B rows', async () => {
    const rows = await asTenant(
      'org_B',
      (tx) => tx`SELECT questions FROM assessments WHERE course_id = 'b0000000-0000-0000-0000-000000000001'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['questions']).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DB-enforced constraints — course-level uniqueness + cascade delete
//
// These exercise the raw DB constraints directly (bypassing the app's
// create-or-replace upsert, which never inserts a duplicate), proving the
// `assessments_course_id_unique` constraint and the course_id ON DELETE
// CASCADE actually hold at the database level. A dedicated course is
// created (and cleaned up) per test so the shared seed data used by other
// specs is left untouched.
// ---------------------------------------------------------------------------

describe('assessment isolation — DB-enforced constraints', () => {
  it('rejects a second assessment insert for the same course_id (unique violation)', async () => {
    const courseId = 'a0000000-0000-0000-0000-0000000000f1';

    // Setup (course + first assessment) commits in its own transaction so
    // the expected-failure INSERT below runs against already-committed rows.
    await asTenant('org_A', async (tx) => {
      await tx`
        INSERT INTO courses (id, academy_id, slug, title, status, position)
        VALUES (${courseId}, 'org_A', 'course-unique-test', 'Course Unique Test', 'published', 1)
      `;
      await tx`
        INSERT INTO assessments (course_id, academy_id, title, questions)
        VALUES (${courseId}, 'org_A', 'First Quiz', '[]')
      `;
    });

    // A failed statement aborts the surrounding transaction, so this must be
    // its own asTenant() call — letting the rejection propagate lets
    // postgres-js roll it back cleanly (same pattern as the cross-tenant
    // write test above).
    await expect(
      asTenant(
        'org_A',
        (tx) =>
          tx`
            INSERT INTO assessments (course_id, academy_id, title, questions)
            VALUES (${courseId}, 'org_A', 'Second Quiz', '[]')
          `,
      ),
    ).rejects.toThrow();

    // Cleanup — cascades to the (single) assessment row created above.
    await superuserClient`DELETE FROM courses WHERE id = ${courseId}`;
  });

  it('deletes the assessment row when its course is deleted (ON DELETE CASCADE)', async () => {
    const courseId = 'a0000000-0000-0000-0000-0000000000f2';

    await asTenant('org_A', async (tx) => {
      await tx`
        INSERT INTO courses (id, academy_id, slug, title, status, position)
        VALUES (${courseId}, 'org_A', 'course-cascade-test', 'Course Cascade Test', 'published', 1)
      `;
      await tx`
        INSERT INTO assessments (course_id, academy_id, title, questions)
        VALUES (${courseId}, 'org_A', 'Quiz To Cascade', '[]')
      `;
    });

    await asTenant('org_A', (tx) =>
      tx`DELETE FROM courses WHERE id = ${courseId}`,
    );

    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM assessments WHERE course_id = ${courseId}`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// FORCE RLS + tenant_isolation policy survive the 0004 migration
// (spec.md: "FORCE RLS and policy survive the migration")
// ---------------------------------------------------------------------------

describe('assessment isolation — FORCE RLS survives 0004 ALTER', () => {
  it('assessments still has FORCE ROW LEVEL SECURITY after the passing_score ALTER', async () => {
    const rows = await superuserClient`
      SELECT relforcerowsecurity FROM pg_class WHERE relname = 'assessments'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['relforcerowsecurity']).toBe(true);
  });

  it('the tenant_isolation policy is still active on assessments', async () => {
    const rows = await superuserClient`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'assessments' AND policyname = 'tenant_isolation'
    `;
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves isolation tests are not vacuously passing
// ---------------------------------------------------------------------------

describe('assessment isolation — negative gate (RLS enforcement is not vacuous)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE assessments DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE assessments ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE assessments FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM assessments WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
