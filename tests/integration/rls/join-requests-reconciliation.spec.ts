/**
 * RLS integration test — Phase 4 reconciliation, grounds the EXACT query
 * shape DrizzleJoinRequestRepository.findApprovedUnfulfilled /
 * FulfillJoinRequestUseCase run (tenant path, via app_user +
 * app.current_tenant_id — same UPDATE grant already proven generically by
 * join-requests-admin-queue.spec.ts, exercised here specifically for the
 * fulfilled_at/membership_id columns).
 *
 * Spec: "Webhook sync fulfills approved request" / cross-tenant fulfillment
 * must be denied (design D1 tenant_isolation policy on join_requests, no new
 * migration needed — PR1's 0011_join_requests_rls.sql already grants
 * UPDATE on join_requests to app_user, tenant-scoped).
 */

import { describe, expect, it, afterAll, afterEach } from 'vitest';
import { asTenant, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

describe('reconciliation — mirrors DrizzleJoinRequestRepository.findApprovedUnfulfilled + save (UPDATE via app_user)', () => {
  afterEach(async () => {
    await superuserClient`DELETE FROM join_requests WHERE email = 'reconcile-flow@student.com'`;
  });

  it('finds an approved, unfulfilled request scoped to the caller academy', async () => {
    await superuserClient`
      INSERT INTO join_requests (id, academy_id, email, status, resolved_at, resolved_by)
      VALUES ('c0000000-0000-0000-0000-000000000096', 'org_A', 'reconcile-flow@student.com', 'approved', now(), 'user_A1')
    `;

    const rows = await asTenant(
      'org_A',
      (tx) => tx`
        SELECT id FROM join_requests
        WHERE academy_id = 'org_A' AND email = 'reconcile-flow@student.com'
          AND status = 'approved' AND fulfilled_at IS NULL
      `,
    );

    expect(rows).toHaveLength(1);
  });

  it('app_user (tenant path) can set fulfilled_at + membership_id on its own academy row', async () => {
    await superuserClient`
      INSERT INTO join_requests (id, academy_id, email, status, resolved_at, resolved_by)
      VALUES ('c0000000-0000-0000-0000-000000000095', 'org_A', 'reconcile-flow@student.com', 'approved', now(), 'user_A1')
    `;

    await asTenant(
      'org_A',
      (tx) => tx`
        UPDATE join_requests
        SET fulfilled_at = now(), membership_id = NULL
        WHERE id = 'c0000000-0000-0000-0000-000000000095'
      `,
    );

    const rows =
      await superuserClient`SELECT fulfilled_at FROM join_requests WHERE id = 'c0000000-0000-0000-0000-000000000095'`;
    expect(rows[0]?.['fulfilled_at']).not.toBeNull();
  });

  it('org_B tenant context cannot fulfill (find OR update) an approved request belonging to org_A (cross-tenant denial)', async () => {
    await superuserClient`
      INSERT INTO join_requests (id, academy_id, email, status, resolved_at, resolved_by)
      VALUES ('c0000000-0000-0000-0000-000000000094', 'org_A', 'reconcile-flow@student.com', 'approved', now(), 'user_A1')
    `;

    const findRows = await asTenant(
      'org_B',
      (tx) => tx`
        SELECT id FROM join_requests
        WHERE academy_id = 'org_A' AND email = 'reconcile-flow@student.com'
          AND status = 'approved' AND fulfilled_at IS NULL
      `,
    );
    expect(findRows).toHaveLength(0);

    await asTenant(
      'org_B',
      (tx) => tx`
        UPDATE join_requests SET fulfilled_at = now()
        WHERE id = 'c0000000-0000-0000-0000-000000000094'
      `,
    );

    const rows =
      await superuserClient`SELECT fulfilled_at FROM join_requests WHERE id = 'c0000000-0000-0000-0000-000000000094'`;
    // RLS silently filters the row out of both the SELECT and the UPDATE's
    // WHERE match (tenant_isolation) — fulfilled_at stays untouched.
    expect(rows[0]?.['fulfilled_at']).toBeNull();
  });

  it('a re-delivered webhook (2nd fulfill) finds nothing once fulfilled_at is already set — idempotent no-op', async () => {
    await superuserClient`
      INSERT INTO join_requests (id, academy_id, email, status, resolved_at, resolved_by, fulfilled_at, membership_id)
      VALUES ('c0000000-0000-0000-0000-000000000093', 'org_A', 'reconcile-flow@student.com', 'approved', now(), 'user_A1', now(), NULL)
    `;

    const rows = await asTenant(
      'org_A',
      (tx) => tx`
        SELECT id FROM join_requests
        WHERE academy_id = 'org_A' AND email = 'reconcile-flow@student.com'
          AND status = 'approved' AND fulfilled_at IS NULL
      `,
    );

    expect(rows).toHaveLength(0);
  });
});
