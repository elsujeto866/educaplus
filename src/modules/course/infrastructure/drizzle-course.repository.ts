import { and, asc, count, eq, max } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { courses } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Course } from '../domain/course.entity';
import type { CourseRepository } from '../domain/ports/course.repository';
import type { PublicationStatus } from '../domain/value-objects/publication-status.vo';

/**
 * Maps a raw DB row to a Course entity.
 */
function toEntity(row: typeof courses.$inferSelect): Course {
  return new Course({
    id: row.id,
    academyId: row.academyId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status as PublicationStatus,
    position: row.position,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Drizzle implementation of CourseRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 */
export class DrizzleCourseRepository implements CourseRepository {
  async create(ctx: TenantContext, course: Course): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(courses).values({
        id: course.id,
        academyId: course.academyId,
        slug: course.slug,
        title: course.title,
        description: course.description,
        status: course.status,
        position: course.position,
        publishedAt: course.publishedAt,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<Course | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx.select().from(courses).where(eq(courses.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findBySlug(
    ctx: TenantContext,
    academyId: string,
    slug: string,
  ): Promise<Course | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(courses)
        .where(and(eq(courses.academyId, academyId), eq(courses.slug, slug)));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByAcademy(ctx: TenantContext, academyId: string): Promise<Course[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(courses)
        .where(eq(courses.academyId, academyId))
        .orderBy(asc(courses.position));
      return rows.map(toEntity);
    });
  }

  async findPublishedByAcademy(ctx: TenantContext, academyId: string): Promise<Course[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(courses)
        .where(and(eq(courses.academyId, academyId), eq(courses.status, 'published')))
        .orderBy(asc(courses.position));
      return rows.map(toEntity);
    });
  }

  async update(ctx: TenantContext, course: Course): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(courses)
        .set({
          slug: course.slug,
          title: course.title,
          description: course.description,
          status: course.status,
          position: course.position,
          publishedAt: course.publishedAt,
          updatedAt: course.updatedAt,
        })
        .where(eq(courses.id, course.id)),
    );
  }

  async delete(ctx: TenantContext, id: string): Promise<void> {
    await withTenant(ctx, (tx) => tx.delete(courses).where(eq(courses.id, id)));
  }

  async existsBySlug(
    ctx: TenantContext,
    academyId: string,
    slug: string,
  ): Promise<boolean> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ n: count() })
        .from(courses)
        .where(and(eq(courses.academyId, academyId), eq(courses.slug, slug)));
      return (result?.n ?? 0) > 0;
    });
  }

  async maxPositionByAcademy(ctx: TenantContext, academyId: string): Promise<number> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ maxPos: max(courses.position) })
        .from(courses)
        .where(eq(courses.academyId, academyId));
      return result?.maxPos ?? 0;
    });
  }
}
