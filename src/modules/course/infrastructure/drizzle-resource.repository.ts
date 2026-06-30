import { and, asc, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { resources } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Resource } from '../domain/resource.entity';
import type { ResourceRepository } from '../domain/ports/resource.repository';
import type { ResourceType } from '../domain/resource.entity';

/**
 * Drizzle implementation of ResourceRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 */
export class DrizzleResourceRepository implements ResourceRepository {
  async create(ctx: TenantContext, resource: Resource): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(resources).values({
        id: resource.id,
        lessonId: resource.lessonId,
        academyId: resource.academyId,
        type: resource.type,
        title: resource.title,
        url: resource.url,
        position: resource.position,
        createdAt: resource.createdAt,
      }),
    );
  }

  async findByLesson(ctx: TenantContext, lessonId: string): Promise<Resource[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(resources)
        .where(eq(resources.lessonId, lessonId))
        .orderBy(asc(resources.position));
      return rows.map(
        (row) =>
          new Resource({
            id: row.id,
            lessonId: row.lessonId,
            academyId: row.academyId,
            type: row.type as ResourceType,
            title: row.title,
            url: row.url,
            position: row.position,
            createdAt: row.createdAt,
          }),
      );
    });
  }

  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) => tx.delete(resources).where(eq(resources.id, id)));
  }

  /**
   * Atomically rewrites positions for the given ordered list of resource IDs.
   * All IDs must already belong to the lesson — enforced by the use-case before calling.
   */
  async reorder(
    ctx: TenantContext,
    lessonId: string,
    orderedIds: string[],
  ): Promise<void> {
    await withTenant(ctx, async (tx) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          tx
            .update(resources)
            .set({ position: index + 1 })
            .where(and(eq(resources.id, id), eq(resources.lessonId, lessonId))),
        ),
      );
    });
  }
}
