import { eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { academies } from '@/shared/infrastructure/db/schema/academy.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Academy } from '../domain/academy.entity';
import type { AcademyRepository } from '../domain/ports/academy.repository';

/**
 * Drizzle implementation of AcademyRepository.
 *
 * ALL table access goes through withTenant() — this is the only path that
 * sets app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * Direct db.select/insert/update calls on `academies` are intentionally absent.
 */
export class DrizzleAcademyRepository implements AcademyRepository {
  async upsert(ctx: TenantContext, academy: Academy): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .insert(academies)
        .values({
          id: academy.id,
          name: academy.name,
          slug: academy.slug,
          settings: academy.settings,
          createdAt: academy.createdAt,
          updatedAt: academy.updatedAt,
          deletedAt: academy.deletedAt,
        })
        .onConflictDoUpdate({
          target: academies.id,
          set: {
            name: academy.name,
            slug: academy.slug,
            settings: academy.settings,
            updatedAt: new Date(),
          },
        }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<Academy | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(academies)
        .where(eq(academies.id, id));
      const row = rows[0];
      if (!row) return null;
      return new Academy({
        id: row.id,
        name: row.name,
        slug: row.slug,
        settings: row.settings as Record<string, unknown> | null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      });
    });
  }

  async softDelete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(academies)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(academies.id, id)),
    );
  }
}
