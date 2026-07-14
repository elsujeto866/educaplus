/**
 * RLS integration tests — PR2 public academy read + request-access submission.
 *
 * PR1's join-requests-isolation.spec.ts already proves the RAW RLS policy
 * boundaries (role scoping, column grants, FORCE RLS). This file grounds
 * the EXACT queries the new PR2 application code runs against those same
 * boundaries:
 *
 *   - DrizzlePublicAcademyRepository.findBySlug: SELECT id,name,slug FROM
 *     academies WHERE slug=? — including the "truly unknown slug" case
 *     (spec "Unknown slug returns 404"), which PR1's suite didn't cover
 *     (it only tested unpublished/deleted, not "no row at all").
 *   - DrizzlePublicJoinRequestRepository.insertPending: INSERT INTO
 *     join_requests (academy_id, email, status) VALUES (...) with no
 *     RETURNING — and, critically, that a duplicate-pending insert fails
 *     with SQLSTATE 23505 specifically (not just "throws"), because
 *     RequestAccessUseCase's isUniqueViolation() check is duck-typed on
 *     `error.code === '23505'` — a wrong SQLSTATE would silently defeat the
 *     idempotency guarantee.
 *
 * Seed (from global-setup): org_A/org_B published; org_C unpublished;
 * org_D soft-deleted. No academy exists for slug 'ghost-academy'.
 */

import { describe, expect, it, afterAll, afterEach } from 'vitest';
import { asPublicRole, closeAll, superuserClient } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

describe('public academy read — mirrors DrizzlePublicAcademyRepository.findBySlug', () => {
  it('returns exactly {id,name,slug} for a published slug', async () => {
    const rows = await asPublicRole(
      (tx) => tx`SELECT id, name, slug FROM academies WHERE slug = 'academy-a'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: 'org_A', name: 'Academy A', slug: 'academy-a' });
  });

  it('returns 0 rows for a truly unknown slug (no academy exists at all)', async () => {
    const rows = await asPublicRole(
      (tx) => tx`SELECT id, name, slug FROM academies WHERE slug = 'ghost-academy'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('returns 0 rows for an unpublished slug (academy exists but is_public=false)', async () => {
    const rows = await asPublicRole(
      (tx) => tx`SELECT id, name, slug FROM academies WHERE slug = 'academy-c'`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('public join-request submission — mirrors DrizzlePublicJoinRequestRepository.insertPending', () => {
  afterEach(async () => {
    await superuserClient`DELETE FROM join_requests WHERE email = 'flow-visitor@student.com'`;
  });

  it('inserts (academy_id, email, status) only, no RETURNING needed', async () => {
    await asPublicRole(
      (tx) => tx`
        INSERT INTO join_requests (academy_id, email, status)
        VALUES ('org_A', 'flow-visitor@student.com', 'pending')
      `,
    );

    const rows =
      await superuserClient`SELECT academy_id, email, status FROM join_requests WHERE email = 'flow-visitor@student.com'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ academy_id: 'org_A', email: 'flow-visitor@student.com', status: 'pending' });
  });

  it('a second pending insert for the same (academy_id, email) fails with SQLSTATE 23505', async () => {
    await asPublicRole(
      (tx) => tx`
        INSERT INTO join_requests (academy_id, email, status)
        VALUES ('org_A', 'flow-visitor@student.com', 'pending')
      `,
    );

    let caught: unknown;
    try {
      await asPublicRole(
        (tx) => tx`
          INSERT INTO join_requests (academy_id, email, status)
          VALUES ('org_A', 'flow-visitor@student.com', 'pending')
        `,
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect((caught as { code?: string } | undefined)?.code).toBe('23505');
  });

  it('academy_public genuinely cannot SELECT its own just-inserted row (no RETURNING is possible)', async () => {
    await asPublicRole(
      (tx) => tx`
        INSERT INTO join_requests (academy_id, email, status)
        VALUES ('org_A', 'flow-visitor@student.com', 'pending')
      `,
    );

    await expect(
      asPublicRole((tx) => tx`SELECT id FROM join_requests WHERE email = 'flow-visitor@student.com'`),
    ).rejects.toThrow();
  });
});
