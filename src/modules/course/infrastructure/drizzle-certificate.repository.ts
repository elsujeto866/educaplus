import { and, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import { certificates } from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Certificate } from '../domain/certificate.entity';
import type { CertificateRepository } from '../domain/ports/certificate.repository';

/**
 * Maps a raw DB row to a Certificate entity.
 */
function toEntity(row: typeof certificates.$inferSelect): Certificate {
  return new Certificate({
    id: row.id,
    courseId: row.courseId,
    academyId: row.academyId,
    clerkUserId: row.clerkUserId,
    certificateCode: row.certificateCode,
    score: row.score,
    studentName: row.studentName,
    courseTitle: row.courseTitle,
    academyName: row.academyName,
    issuedAt: row.issuedAt,
  });
}

/**
 * Drizzle implementation of CertificateRepository.
 *
 * ALL table access goes through withTenant() — the only path that sets
 * app.current_tenant_id and satisfies the deny-by-default RLS policy.
 * unique(course_id, clerk_user_id) backs `create` — a concurrent insert
 * race surfaces as a Postgres unique-violation (SQLSTATE 23505), which
 * propagates unmodified to the caller (IssueCertificateUseCase re-reads
 * and returns the winning row instead of surfacing the DB error).
 */
export class DrizzleCertificateRepository implements CertificateRepository {
  async create(ctx: TenantContext, certificate: Certificate): Promise<void> {
    await withTenant(ctx, (tx) =>
      tx.insert(certificates).values({
        id: certificate.id,
        courseId: certificate.courseId,
        academyId: certificate.academyId,
        clerkUserId: certificate.clerkUserId,
        certificateCode: certificate.certificateCode,
        score: certificate.score,
        studentName: certificate.studentName,
        courseTitle: certificate.courseTitle,
        academyName: certificate.academyName,
        issuedAt: certificate.issuedAt,
      }),
    );
  }

  async findByCourseAndUser(
    ctx: TenantContext,
    courseId: string,
    clerkUserId: string,
  ): Promise<Certificate | null> {
    return withTenant(ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(certificates)
        .where(and(eq(certificates.courseId, courseId), eq(certificates.clerkUserId, clerkUserId)));
      return rows[0] ? toEntity(rows[0]) : null;
    });
  }
}
