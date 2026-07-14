import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { JoinRequest } from '../entities/join-request.entity';

/**
 * Port: JoinRequestRepository (ADMIN / TENANT path)
 *
 * Every method receives TenantContext first — same convention as
 * AcademyRepository/MembershipRepository. Implemented via withTenant(),
 * scoped by the standard `tenant_isolation` RLS policy on join_requests.
 *
 * This is the ADMIN counterpart to JoinRequestSubmissionPort (the public,
 * untenanted insert path) — kept as two separate ports so the type system
 * enforces which security path a use-case is allowed to reach.
 */
export interface JoinRequestRepository {
  /** Pending requests for the caller's own academy (admin queue, Phase 3). */
  listPendingByAcademy(ctx: TenantContext): Promise<JoinRequest[]>;

  findById(ctx: TenantContext, id: string): Promise<JoinRequest | null>;

  /** Persists the current state of a JoinRequest (insert or update). */
  save(ctx: TenantContext, joinRequest: JoinRequest): Promise<void>;

  /**
   * Reconciliation (Phase 4): finds the `approved`, not-yet-fulfilled
   * request matching (academyId, email), if any. Match key mirrors design
   * D3 — email is the only join key, memberships has no email column.
   */
  findApprovedUnfulfilled(
    ctx: TenantContext,
    academyId: string,
    email: string,
  ): Promise<JoinRequest | null>;
}
