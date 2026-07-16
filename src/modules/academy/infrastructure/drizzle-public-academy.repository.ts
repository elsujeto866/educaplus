import { eq } from 'drizzle-orm';
import { withPublicRole } from '@/shared/infrastructure/db/with-public-role';
import { academies } from '@/shared/infrastructure/db/schema/academy.schema';
import type { PublicAcademyPort, PublicAcademyView } from '../domain/ports/public-academy.port';

/**
 * Drizzle implementation of PublicAcademyPort.
 *
 * ALL access goes through withPublicRole() — SET LOCAL ROLE academy_public,
 * never withTenant() and never a raw `db` call. Explicit column projection
 * (no select *) mirrors the column-level GRANT (id, name, slug, is_public,
 * deleted_at) — RLS's `public_read` policy on `academies` already restricts
 * rows to published, non-deleted academies (design D2), so this adapter
 * never needs to filter on isPublic/deletedAt itself.
 */
export class DrizzlePublicAcademyRepository implements PublicAcademyPort {
  async findBySlug(slug: string): Promise<PublicAcademyView | null> {
    return withPublicRole(async (tx) => {
      const rows = await tx
        .select({ id: academies.id, name: academies.name, slug: academies.slug })
        .from(academies)
        .where(eq(academies.slug, slug));
      const row = rows[0];
      if (!row) return null;
      return { id: row.id, name: row.name, slug: row.slug };
    });
  }

  async findAllPublished(): Promise<PublicAcademyView[]> {
    return withPublicRole(async (tx) => {
      // No WHERE on isPublic/deletedAt — RLS's `public_read` policy already
      // scopes visible rows to published, non-deleted academies. Ordered by
      // name for a stable, readable directory.
      const rows = await tx
        .select({ id: academies.id, name: academies.name, slug: academies.slug })
        .from(academies)
        .orderBy(academies.name);
      return rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
    });
  }
}
