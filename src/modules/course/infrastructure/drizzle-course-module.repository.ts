import { and, asc, count, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { courseModules } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { CourseModule } from '../domain/course-module.entity';
import type { CourseModuleRepository } from '../domain/ports/course-module.repository';

/**
 * Maps a raw DB row to a CourseModule entity.
 */
function toEntity(row: typeof courseModules.$inferSelect): CourseModule {
  return new CourseModule({
    id: row.id,
    courseId: row.courseId,
    academyId: row.academyId,
    title: row.title,
    description: row.description,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of CourseModuleRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 */
export class DrizzleCourseModuleRepository implements CourseModuleRepository {
  async create(ctx: TenantContext, module: CourseModule): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(courseModules).values({
        id: module.id,
        courseId: module.courseId,
        academyId: module.academyId,
        title: module.title,
        description: module.description,
        position: module.position,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
      }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<CourseModule | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(courseModules)
        .where(eq(courseModules.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByCourse(ctx: TenantContext, courseId: string): Promise<CourseModule[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId))
        .orderBy(asc(courseModules.position));
      return rows.map(toEntity);
    });
  }

  async update(ctx: TenantContext, module: CourseModule): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(courseModules)
        .set({
          title: module.title,
          description: module.description,
          position: module.position,
          updatedAt: module.updatedAt,
        })
        .where(eq(courseModules.id, module.id)),
    );
  }

  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.delete(courseModules).where(eq(courseModules.id, id)),
    );
  }

  async countByCourse(ctx: TenantContext, courseId: string): Promise<number> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ n: count() })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));
      return result?.n ?? 0;
    });
  }

  /**
   * Atomically rewrites positions for the given ordered list of module IDs.
   * All IDs must already belong to the course — enforced by the use-case before calling.
   */
  async reorder(
    ctx: TenantContext,
    courseId: string,
    orderedIds: string[],
  ): Promise<void> {
    await withTenant(ctx, async (tx) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          tx
            .update(courseModules)
            .set({ position: index + 1 })
            .where(
              and(eq(courseModules.id, id), eq(courseModules.courseId, courseId)),
            ),
        ),
      );
    });
  }
}
