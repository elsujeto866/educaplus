import { and, count, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { enrollments } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Enrollment } from '../domain/enrollment.entity';
import type { EnrollmentRepository } from '../domain/ports/enrollment.repository';

/**
 * Maps a raw DB row to an Enrollment entity.
 */
function toEntity(row: typeof enrollments.$inferSelect): Enrollment {
  return new Enrollment({
    id: row.id,
    courseId: row.courseId,
    academyId: row.academyId,
    clerkUserId: row.clerkUserId,
    enrolledAt: row.enrolledAt,
    completedAt: row.completedAt,
  });
}

/**
 * Drizzle implementation of EnrollmentRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 */
export class DrizzleEnrollmentRepository implements EnrollmentRepository {
  async create(ctx: TenantContext, enrollment: Enrollment): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(enrollments).values({
        id: enrollment.id,
        courseId: enrollment.courseId,
        academyId: enrollment.academyId,
        clerkUserId: enrollment.clerkUserId,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
      }),
    );
  }

  async findById(ctx: TenantContext, id: string): Promise<Enrollment | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(enrollments)
        .where(eq(enrollments.id, id));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByCourseAndUser(
    ctx: TenantContext,
    courseId: string,
    clerkUserId: string,
  ): Promise<Enrollment | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            eq(enrollments.clerkUserId, clerkUserId),
          ),
        );
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }

  async findByCourse(ctx: TenantContext, courseId: string): Promise<Enrollment[]> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(enrollments)
        .where(eq(enrollments.courseId, courseId));
      return rows.map(toEntity);
    });
  }

  async update(ctx: TenantContext, enrollment: Enrollment): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx
        .update(enrollments)
        .set({ completedAt: enrollment.completedAt })
        .where(eq(enrollments.id, enrollment.id)),
    );
  }

  async existsByCourseAndUser(
    ctx: TenantContext,
    courseId: string,
    clerkUserId: string,
  ): Promise<boolean> {
    return withTenant(ctx, async (tx) => {
      const [result] = await tx
        .select({ n: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            eq(enrollments.clerkUserId, clerkUserId),
          ),
        );
      return (result?.n ?? 0) > 0;
    });
  }
}
