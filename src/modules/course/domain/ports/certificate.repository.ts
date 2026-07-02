import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Certificate } from '../certificate.entity';

/**
 * Port: CertificateRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * unique(course_id, clerk_user_id) backs the (courseId, clerkUserId) pair —
 * `create` may reject with a Postgres unique-violation on an insert race;
 * the infra implementation is responsible for surfacing that so the
 * use-case can treat it idempotently.
 */
export interface CertificateRepository {
  create(ctx: TenantContext, certificate: Certificate): Promise<void>;

  /** The certificate for (courseId, clerkUserId), or null if none exists yet. */
  findByCourseAndUser(
    ctx: TenantContext,
    courseId: string,
    clerkUserId: string,
  ): Promise<Certificate | null>;
}
