import { DrizzleAcademyRepository } from './infrastructure/drizzle-academy.repository';
import { DrizzleMembershipRepository } from './infrastructure/drizzle-membership.repository';
import { DrizzlePublicAcademyRepository } from './infrastructure/drizzle-public-academy.repository';
import { DrizzlePublicJoinRequestRepository } from './infrastructure/drizzle-public-join-request.repository';
import { DrizzleJoinRequestRepository } from './infrastructure/drizzle-join-request.repository';
import { ClerkInvitationAdapter } from './infrastructure/clerk-invitation.adapter';
import { ProvisionAcademyUseCase } from './application/provision-academy.use-case';
import { GetAcademyUseCase } from './application/get-academy.use-case';
import { SyncMembershipUseCase } from './application/sync-membership.use-case';
import { DeleteAcademyUseCase } from './application/delete-academy.use-case';
import { DeleteMembershipUseCase } from './application/delete-membership.use-case';
import { GetPublicAcademyUseCase } from './application/get-public-academy.use-case';
import { RequestAccessUseCase } from './application/request-access.use-case';
import { ListPendingJoinRequestsUseCase } from './application/list-pending-join-requests.use-case';
import { ApproveJoinRequestUseCase } from './application/approve-join-request.use-case';
import { RejectJoinRequestUseCase } from './application/reject-join-request.use-case';

export interface AcademyComposition {
  provisionAcademy: ProvisionAcademyUseCase;
  getAcademy: GetAcademyUseCase;
  syncMembership: SyncMembershipUseCase;
  deleteAcademy: DeleteAcademyUseCase;
  deleteMembership: DeleteMembershipUseCase;
  /** Public/untenanted path (design D1) — never receives TenantContext. */
  getPublicAcademy: GetPublicAcademyUseCase;
  requestAccess: RequestAccessUseCase;
  /** Admin approval queue (Phase 3) — tenant path, admin/instructor only. */
  listPendingJoinRequests: ListPendingJoinRequestsUseCase;
  approveJoinRequest: ApproveJoinRequestUseCase;
  rejectJoinRequest: RejectJoinRequestUseCase;
}

/**
 * Factory function — explicit DI wiring, no IoC container.
 *
 * Call once per request (or cache at module scope for connection reuse).
 * The composition object owns the use-case instances; repos are created fresh
 * per call so their lifecycle mirrors the request scope.
 */
export function makeAcademyComposition(): AcademyComposition {
  const academyRepo = new DrizzleAcademyRepository();
  const membershipRepo = new DrizzleMembershipRepository();
  const publicAcademyRepo = new DrizzlePublicAcademyRepository();
  const publicJoinRequestRepo = new DrizzlePublicJoinRequestRepository();
  const joinRequestRepo = new DrizzleJoinRequestRepository();
  const invitationAdapter = new ClerkInvitationAdapter();

  return {
    provisionAcademy: new ProvisionAcademyUseCase(academyRepo),
    getAcademy: new GetAcademyUseCase(academyRepo),
    syncMembership: new SyncMembershipUseCase(membershipRepo),
    deleteAcademy: new DeleteAcademyUseCase(academyRepo),
    deleteMembership: new DeleteMembershipUseCase(membershipRepo),
    getPublicAcademy: new GetPublicAcademyUseCase(publicAcademyRepo),
    requestAccess: new RequestAccessUseCase(publicJoinRequestRepo),
    listPendingJoinRequests: new ListPendingJoinRequestsUseCase(joinRequestRepo),
    approveJoinRequest: new ApproveJoinRequestUseCase(joinRequestRepo, invitationAdapter),
    rejectJoinRequest: new RejectJoinRequestUseCase(joinRequestRepo),
  };
}
