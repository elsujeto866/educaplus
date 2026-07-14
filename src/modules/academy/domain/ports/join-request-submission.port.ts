import type { JoinRequest } from '../entities/join-request.entity';

/**
 * Port: JoinRequestSubmissionPort (PUBLIC / UNTENANTED path)
 *
 * Used exclusively by RequestAccessUseCase (Phase 2) for unauthenticated
 * visitors submitting the request-access form at /a/[slug]. Deliberately
 * takes NO TenantContext — a visitor has no orgId. The infrastructure
 * adapter implements this via withPublicRole() (SET LOCAL ROLE
 * academy_public), never withTenant().
 *
 * Split from JoinRequestRepository (the admin/tenant port) so the type
 * system keeps the public and tenant security paths separate — a use-case
 * that only depends on this port physically cannot reach a tenant-scoped
 * repository method.
 */
export interface JoinRequestSubmissionPort {
  /**
   * Looks up an existing pending request for (academyId, email) — used to
   * implement "Duplicate Pending Idempotency" (spec) without relying on the
   * DB unique-violation error as control flow.
   */
  findPendingByAcademyAndEmail(academyId: string, email: string): Promise<JoinRequest | null>;

  /** Inserts a new pending request. Rejected by RLS if the academy is not published. */
  insertPending(joinRequest: JoinRequest): Promise<void>;
}
