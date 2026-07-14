/**
 * RLS isolation integration tests — join_requests + academies.is_public
 * (design D1 — role-scoped RLS for the public, untenanted join-request path).
 *
 * Two independent security paths are exercised here:
 *
 *   PUBLIC path (academy_public role, via asPublicRole — mirrors
 *   withPublicRole()'s SET LOCAL ROLE):
 *     - CAN insert a pending join_request for a PUBLISHED, non-deleted academy.
 *     - CANNOT insert for a non-public (is_public=false) academy.
 *     - CANNOT insert for a soft-deleted academy (deleted_at set), even if
 *       is_public=true.
 *     - CANNOT insert a non-pending row (status != 'pending').
 *     - CANNOT SELECT from join_requests at all — no SELECT grant exists.
 *     - CAN read {id,name,slug} of a published academy via public_read.
 *     - CANNOT read a non-public or soft-deleted academy (0 rows).
 *     - CANNOT SELECT a column outside the column-level GRANT (e.g. settings).
 *
 *   ADMIN/TENANT path (app_user role, via asTenant — mirrors withTenant()):
 *     - Same-tenant read allowed; cross-tenant read blocked (tenant_isolation,
 *       same pattern as every other table).
 *     - No context set — deny-by-default, 0 rows.
 *     - public_read does NOT leak onto app_user: org_A context cannot see
 *       org_C (non-public) even though academy_public can read published
 *       academies — proves the policy is TRULY role-scoped, not table-wide.
 *
 *   Partial unique index:
 *     - A second pending insert for the same (academy_id, email) while one
 *       pending row already exists is rejected (unique_violation, 23505).
 *
 *   Negative gate:
 *     - Disabling RLS on join_requests proves the isolation assertion is not
 *       vacuously green.
 *
 * Seed (from global-setup):
 *   org_A / org_B — published (is_public=true, default), one pending
 *     join_request each (pending-a@student.com / pending-b@student.com).
 *   org_C — is_public=false (unpublished).
 *   org_D — is_public=true but deleted_at set (soft-deleted).
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { appUserClient, asPublicRole, asTenant, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

// ---------------------------------------------------------------------------
// PUBLIC path — join_requests INSERT (public_insert policy)
// ---------------------------------------------------------------------------

describe('public_insert — academy_public can insert a pending request for a published academy', () => {
  afterEach(async () => {
    await superuserClient`DELETE FROM join_requests WHERE email = 'visitor@student.com'`;
  });

  it('inserts a pending row for org_A (published, non-deleted)', async () => {
    await asPublicRole(
      (tx) => tx`
        INSERT INTO join_requests (academy_id, email, status)
        VALUES ('org_A', 'visitor@student.com', 'pending')
      `,
    );

    const rows =
      await superuserClient`SELECT status FROM join_requests WHERE email = 'visitor@student.com'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['status']).toBe('pending');
  });
});

describe('public_insert — academy_public cannot insert for a non-public academy', () => {
  it('rejects insert for org_C (is_public=false)', async () => {
    await expect(
      asPublicRole(
        (tx) => tx`
          INSERT INTO join_requests (academy_id, email, status)
          VALUES ('org_C', 'visitor@student.com', 'pending')
        `,
      ),
    ).rejects.toThrow();
  });
});

describe('public_insert — academy_public cannot insert for a soft-deleted academy', () => {
  it('rejects insert for org_D (deleted_at set, is_public=true)', async () => {
    await expect(
      asPublicRole(
        (tx) => tx`
          INSERT INTO join_requests (academy_id, email, status)
          VALUES ('org_D', 'visitor@student.com', 'pending')
        `,
      ),
    ).rejects.toThrow();
  });
});

describe('public_insert — academy_public cannot insert a non-pending row', () => {
  it('rejects an insert with status=approved', async () => {
    await expect(
      asPublicRole(
        (tx) => tx`
          INSERT INTO join_requests (academy_id, email, status)
          VALUES ('org_A', 'visitor@student.com', 'approved')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PUBLIC path — join_requests SELECT (no grant at all)
// ---------------------------------------------------------------------------

describe('academy_public cannot SELECT join_requests', () => {
  it('rejects a plain SELECT (no SELECT grant on join_requests)', async () => {
    await expect(asPublicRole((tx) => tx`SELECT id FROM join_requests`)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PUBLIC path — academies SELECT (public_read policy + column-level grant)
// ---------------------------------------------------------------------------

describe('public_read — academy_public can read a published academy', () => {
  it('returns id/name/slug for org_A', async () => {
    const rows = await asPublicRole(
      (tx) => tx`SELECT id, name, slug FROM academies WHERE slug = 'academy-a'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['id']).toBe('org_A');
  });
});

describe('public_read — academy_public cannot read a non-public academy', () => {
  it('returns 0 rows for org_C (is_public=false)', async () => {
    const rows = await asPublicRole(
      (tx) => tx`SELECT id, name, slug FROM academies WHERE slug = 'academy-c'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('public_read — academy_public cannot read a soft-deleted academy', () => {
  it('returns 0 rows for org_D (deleted_at set)', async () => {
    const rows = await asPublicRole(
      (tx) => tx`SELECT id, name, slug FROM academies WHERE slug = 'academy-d'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('academy_public cannot read columns outside the column-level grant', () => {
  it('rejects a SELECT of settings (only id/name/slug are granted)', async () => {
    await expect(
      asPublicRole((tx) => tx`SELECT settings FROM academies WHERE slug = 'academy-a'`),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ADMIN/TENANT path — join_requests tenant_isolation (mirrors every other table)
// ---------------------------------------------------------------------------

describe('tenant read isolation (join_requests)', () => {
  it('allows same-tenant read: org_A context sees org_A join_requests', async () => {
    const rows = await asTenant('org_A', (tx) => tx`SELECT academy_id FROM join_requests`);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
  });

  it('blocks cross-tenant read: org_A context cannot see org_B join_requests', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM join_requests WHERE academy_id = 'org_B'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('deny-by-default (no tenant context set) — join_requests', () => {
  it('returns 0 rows when app.current_tenant_id is not set', async () => {
    const rows = await appUserClient`SELECT id FROM join_requests`;
    expect(rows).toHaveLength(0);
  });
});

describe('public_read does not leak onto app_user', () => {
  it('org_A tenant context still cannot see org_C, even though academy_public can read published academies', async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`SELECT id FROM academies WHERE id = 'org_C'`,
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Partial unique index — one pending request per (academy_id, email)
// ---------------------------------------------------------------------------

describe('partial unique index blocks a second pending request', () => {
  afterEach(async () => {
    await superuserClient`DELETE FROM join_requests WHERE email = 'dup@student.com'`;
  });

  it('rejects a second pending insert for the same (academy_id, email)', async () => {
    await asPublicRole(
      (tx) => tx`
        INSERT INTO join_requests (academy_id, email, status)
        VALUES ('org_A', 'dup@student.com', 'pending')
      `,
    );

    await expect(
      asPublicRole(
        (tx) => tx`
          INSERT INTO join_requests (academy_id, email, status)
          VALUES ('org_A', 'dup@student.com', 'pending')
        `,
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Negative gate — proves the tenant isolation assertion is not vacuous
// ---------------------------------------------------------------------------

describe('negative gate — RLS enforcement is not vacuous (join_requests)', () => {
  beforeAll(async () => {
    await superuserClient`ALTER TABLE join_requests DISABLE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    await superuserClient`ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY`;
    await superuserClient`ALTER TABLE join_requests FORCE ROW LEVEL SECURITY`;
  });

  it.fails(
    'cross-tenant read returns 0 rows (FAILS without RLS — proving tests are not vacuous)',
    async () => {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`SELECT id FROM join_requests WHERE academy_id = 'org_B'`,
      );
      expect(rows).toHaveLength(0);
    },
  );
});
