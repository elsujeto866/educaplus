/**
 * RLS integration test — PR3 admin approval queue read path, grounds the
 * EXACT query DrizzleJoinRequestRepository.listPendingByAcademy runs
 * (tenant path, via app_user + app.current_tenant_id — NOT the public
 * academy_public role tested in join-requests-isolation.spec.ts).
 *
 * PR1's join-requests-isolation.spec.ts already proves generic tenant read
 * isolation on join_requests (any column, any status). This file proves the
 * ADMIN QUEUE's specific shape: filtered to status='pending', scoped to the
 * caller's own academy_id, ordered oldest-first — spec "Role- and
 * Tenant-Scoped Queue Access" / "Cross-academy isolation".
 *
 * Seed (global-setup): org_A has one pending join_request
 * (pending-a@student.com), org_B has one pending join_request
 * (pending-b@student.com). user_A1 is org_A's admin.
 */

import { describe, expect, it, afterAll, afterEach } from 'vitest';
import { asTenant, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

describe('admin queue — mirrors DrizzleJoinRequestRepository.listPendingByAcademy', () => {
  it("returns only org_A's pending requests, ordered oldest-first", async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`
        SELECT academy_id, email, status
        FROM join_requests
        WHERE academy_id = 'org_A' AND status = 'pending'
        ORDER BY created_at ASC
      `,
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => (r as { academy_id: string }).academy_id === 'org_A')).toBe(true);
    expect(rows.some((r) => (r as { email: string }).email === 'pending-a@student.com')).toBe(true);
  });

  it("org_A tenant context cannot see org_B's pending requests (cross-academy isolation)", async () => {
    const rows = await asTenant(
      'org_A',
      (tx) => tx`
        SELECT id FROM join_requests WHERE academy_id = 'org_B' AND status = 'pending'
      `,
    );
    expect(rows).toHaveLength(0);
  });

  it('excludes resolved (approved/rejected) requests from the pending queue', async () => {
    await superuserClient`
      INSERT INTO join_requests (id, academy_id, email, status, resolved_at, resolved_by)
      VALUES ('c0000000-0000-0000-0000-000000000099', 'org_A', 'already-approved@student.com', 'approved', now(), 'user_A1')
    `;

    try {
      const rows = await asTenant(
        'org_A',
        (tx) => tx`
          SELECT email FROM join_requests WHERE academy_id = 'org_A' AND status = 'pending'
        `,
      );
      expect(rows.some((r) => (r as { email: string }).email === 'already-approved@student.com')).toBe(false);
    } finally {
      await superuserClient`DELETE FROM join_requests WHERE id = 'c0000000-0000-0000-0000-000000000099'`;
    }
  });
});

describe('admin approve/reject — mirrors DrizzleJoinRequestRepository.save (UPDATE via app_user)', () => {
  afterEach(async () => {
    await superuserClient`DELETE FROM join_requests WHERE email = 'approve-flow@student.com'`;
  });

  it('app_user (tenant path) can update status/resolved_at/resolved_by on its own academy row', async () => {
    await superuserClient`
      INSERT INTO join_requests (id, academy_id, email, status)
      VALUES ('c0000000-0000-0000-0000-000000000098', 'org_A', 'approve-flow@student.com', 'pending')
    `;

    await asTenant(
      'org_A',
      (tx) => tx`
        UPDATE join_requests
        SET status = 'approved', resolved_at = now(), resolved_by = 'user_A1'
        WHERE id = 'c0000000-0000-0000-0000-000000000098'
      `,
    );

    const rows =
      await superuserClient`SELECT status, resolved_by FROM join_requests WHERE id = 'c0000000-0000-0000-0000-000000000098'`;
    expect(rows[0]).toMatchObject({ status: 'approved', resolved_by: 'user_A1' });
  });

  it('app_user cannot update a row belonging to another academy (tenant_isolation)', async () => {
    await superuserClient`
      INSERT INTO join_requests (id, academy_id, email, status)
      VALUES ('c0000000-0000-0000-0000-000000000097', 'org_B', 'approve-flow@student.com', 'pending')
    `;

    try {
      await asTenant(
        'org_A',
        (tx) => tx`
          UPDATE join_requests SET status = 'approved' WHERE id = 'c0000000-0000-0000-0000-000000000097'
        `,
      );

      const rows =
        await superuserClient`SELECT status FROM join_requests WHERE id = 'c0000000-0000-0000-0000-000000000097'`;
      // RLS silently filters the row out of the UPDATE's WHERE match (0 rows
      // affected) rather than throwing — status stays 'pending', unchanged.
      expect(rows[0]?.['status']).toBe('pending');
    } finally {
      await superuserClient`DELETE FROM join_requests WHERE id = 'c0000000-0000-0000-0000-000000000097'`;
    }
  });
});
