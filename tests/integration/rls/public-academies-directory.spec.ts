/**
 * RLS integration test — public academies directory read.
 *
 * Grounds the EXACT query DrizzlePublicAcademyRepository.findAllPublished runs
 * (`SELECT id, name, slug FROM academies ORDER BY name` under SET LOCAL ROLE
 * academy_public) against the live `public_read` RLS policy. The repository
 * applies NO is_public/deleted_at filter of its own — this test proves RLS is
 * what excludes the unpublished and soft-deleted academies, so a future policy
 * regression would surface here rather than leaking private academies into the
 * public directory.
 *
 * Seed (global-setup): org_A 'Academy A'/academy-a and org_B 'Academy
 * B'/academy-b are published; academy-c is is_public=false; academy-d is
 * soft-deleted.
 */

import { describe, expect, it, afterAll } from 'vitest';
import { asPublicRole, closeAll } from '../db/test-client';

afterAll(async () => {
  await closeAll();
});

describe('public academies directory — mirrors DrizzlePublicAcademyRepository.findAllPublished', () => {
  it('lists only published, non-deleted academies, ordered by name', async () => {
    const rows = await asPublicRole(
      (tx) => tx`SELECT id, name, slug FROM academies ORDER BY name`,
    );

    const slugs = rows.map((row) => row.slug);
    expect(slugs).toEqual(['academy-a', 'academy-b']);
    expect(slugs).not.toContain('academy-c'); // is_public = false
    expect(slugs).not.toContain('academy-d'); // soft-deleted
  });
});
