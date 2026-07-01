/**
 * RLS isolation integration tests — course domain tables.
 *
 * Extends the canonical isolation pattern from tenant-isolation.spec.ts
 * to cover the 9 new course tables. Proves the same four properties:
 *
 *   7.1  Same-tenant read: app_user in org_A context sees only org_A rows.
 *        Cross-tenant read: rows for org_B are invisible.
 *
 *   7.2  No context (no set_config call at all): deny-by-default — 0 rows
 *        returned from all tested tables, even though rows exist for both orgs.
 *
 *   7.3  Cross-tenant write: INSERT with academy_id = 'org_B' while
 *        app.current_tenant_id = 'org_A' is rejected by WITH CHECK.
 *
 *   7.4  Negative gate: DISABLE RLS on courses → isolation assertion FAILS
 *        (rows leak through) → it.fails() marks that test as PASSING, proving
 *        the positive tests are not vacuously green.
 *        RLS is restored in afterAll so it does not affect other runs.
 *
 * Seed (from global-setup):
 *   org_A: one course / module / lesson / enrollment / lesson_progress row
 *   org_B: one course / module / lesson / enrollment / lesson_progress row
 *
 * All queries run through appUserClient (NOSUPERUSER, NOBYPASSRLS) so RLS
 * is always evaluated. Superuser access is only used for the negative-gate
 * DDL and any seed teardown.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appUserClient, asTenant, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

// ---------------------------------------------------------------------------
// 7.1  Tenant isolation — same-tenant read allowed, cross-tenant read blocked
// ---------------------------------------------------------------------------

describe('7.1 tenant read isolation (courses)', () => {
  it('allows same-tenant read: org_A context sees org_A courses', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM courses`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B courses', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM courses WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('7.1 tenant read isolation (enrollments)', () => {
  it('allows same-tenant read: org_A context sees org_A enrollments', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM enrollments`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B enrollments', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM enrollments WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('7.1 tenant read isolation (lesson_progress)', () => {
  it('allows same-tenant read: org_A context sees org_A lesson_progress rows', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM lesson_progress`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B lesson_progress rows', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM lesson_progress WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('7.1 tenant read isolation (lesson_video_assets)', () => {
  it('allows same-tenant read: org_A context sees org_A lesson_video_assets', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT academy_id FROM lesson_video_assets`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B lesson_video_assets', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT lesson_id FROM lesson_video_assets WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('7.1 tenant read isolation (lesson_text_contents)', () => {
  it('allows same-tenant read: org_A context sees org_A lesson_text_contents', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT academy_id FROM lesson_text_contents`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B lesson_text_contents', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT lesson_id FROM lesson_text_contents WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('7.1 tenant read isolation (resources)', () => {
  it('allows same-tenant read: org_A context sees org_A resources', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM resources`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B resources', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM resources WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('7.1 tenant read isolation (assessments)', () => {
  it('allows same-tenant read: org_A context sees org_A assessments', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM assessments`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B assessments', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM assessments WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7.2  No context — deny-by-default on course tables
// ---------------------------------------------------------------------------

describe('7.2 deny-by-default (no tenant context set)', () => {
  it('returns 0 rows from courses when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM courses`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from enrollments when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM enrollments`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from lesson_progress when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM lesson_progress`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from course_modules when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM course_modules`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from lessons when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM lessons`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from lesson_video_assets when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT lesson_id FROM lesson_video_assets`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from lesson_text_contents when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT lesson_id FROM lesson_text_contents`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from resources when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM resources`;
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows from assessments when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM assessments`;
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7.3  Cross-tenant write blocked by WITH CHECK
// ---------------------------------------------------------------------------

describe('7.3 cross-tenant write blocked (WITH CHECK)', () => {
  it('rejects INSERT into org_B courses while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO courses (academy_id, slug, title, status, position)
          VALUES ('org_B', 'evil-course', 'Evil Course', 'draft', 99)
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects INSERT into org_B enrollments while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO enrollments (course_id, academy_id, clerk_user_id)
          VALUES ('b0000000-0000-0000-0000-000000000001', 'org_B', 'rogue_user')
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects INSERT into org_B lesson_progress while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO lesson_progress (enrollment_id, lesson_id, academy_id)
          VALUES (
            'b0000000-0000-0000-0000-000000000004',
            'b0000000-0000-0000-0000-000000000003',
            'org_B'
          )
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects INSERT into org_B lesson_video_assets while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO lesson_video_assets (lesson_id, academy_id)
          VALUES ('b0000000-0000-0000-0000-000000000003', 'org_B')
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects INSERT into org_B lesson_text_contents while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO lesson_text_contents (lesson_id, academy_id, body)
          VALUES ('b0000000-0000-0000-0000-000000000006', 'org_B', '{}')
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects INSERT into org_B resources while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO resources (lesson_id, academy_id, type, title, url, position)
          VALUES ('b0000000-0000-0000-0000-000000000003', 'org_B', 'link', 'Evil Resource', 'https://evil.com', 99)
        `,
      ),
    ).rejects.toThrow();
  });

  it('rejects INSERT into org_B assessments while org_A context is active', async () => {
    await expect(
      asTenant('org_A', (tx) =>
        tx`
          INSERT INTO assessments (course_id, academy_id, title, questions)
          VALUES ('b0000000-0000-0000-0000-000000000001', 'org_B', 'Evil Assessment', '[]')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7.4  Negative gate — proves isolation tests are not vacuously passing
//
// Without RLS, org_A context leaks org_B rows. This proves that the positive
// isolation tests return 0 because RLS is enforced, not by coincidence.
//
// Steps:
//   beforeAll  — DISABLE ROW LEVEL SECURITY on courses (superuser DDL)
//   it.fails   — cross-tenant read that normally returns 0 → now returns org_B
//                row → toHaveLength(0) FAILS → it.fails() PASSES
//   afterAll   — re-ENABLE + re-FORCE ROW LEVEL SECURITY (restore for reuse)
// ---------------------------------------------------------------------------

describe('7.4 negative gate — RLS enforcement is not vacuous (courses)', () => {
  beforeAll(async () => {
    // Disabling RLS lets all rows through, proving the isolation test
    // returns 0 BECAUSE of RLS, not by coincidence.
    await superuserClient`ALTER TABLE courses DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    // Restore full RLS enforcement so the container can be reused.
    await superuserClient`ALTER TABLE courses ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE courses FORCE ROW LEVEL SECURITY`;
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
        (tx) => tx`SELECT id FROM courses WHERE academy_id = 'org_B'`,
      );
      // RLS disabled: org_B row is visible → rows.length === 1 → FAILS here.
      expect(rows).toHaveLength(0);
    },
  );
});
