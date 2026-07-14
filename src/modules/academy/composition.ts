import { DrizzleAcademyRepository } from './infrastructure/drizzle-academy.repository';
import { DrizzleMembershipRepository } from './infrastructure/drizzle-membership.repository';
import { DrizzlePublicAcademyRepository } from './infrastructure/drizzle-public-academy.repository';
import { DrizzlePublicJoinRequestRepository } from './infrastructure/drizzle-public-join-request.repository';
import { ProvisionAcademyUseCase } from './application/provision-academy.use-case';
import { GetAcademyUseCase } from './application/get-academy.use-case';
import { SyncMembershipUseCase } from './application/sync-membership.use-case';
import { DeleteAcademyUseCase } from './application/delete-academy.use-case';
import { DeleteMembershipUseCase } from './application/delete-membership.use-case';
import { GetPublicAcademyUseCase } from './application/get-public-academy.use-case';
import { RequestAccessUseCase } from './application/request-access.use-case';

export interface AcademyComposition {
  provisionAcademy: ProvisionAcademyUseCase;
  getAcademy: GetAcademyUseCase;
  syncMembership: SyncMembershipUseCase;
  deleteAcademy: DeleteAcademyUseCase;
  deleteMembership: DeleteMembershipUseCase;
  /** Public/untenanted path (design D1) — never receives TenantContext. */
  getPublicAcademy: GetPublicAcademyUseCase;
  requestAccess: RequestAccessUseCase;
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

  return {
    provisionAcademy: new ProvisionAcademyUseCase(academyRepo),
    getAcademy: new GetAcademyUseCase(academyRepo),
    syncMembership: new SyncMembershipUseCase(membershipRepo),
    deleteAcademy: new DeleteAcademyUseCase(academyRepo),
    deleteMembership: new DeleteMembershipUseCase(membershipRepo),
    getPublicAcademy: new GetPublicAcademyUseCase(publicAcademyRepo),
    requestAccess: new RequestAccessUseCase(publicJoinRequestRepo),
  };
}
