import { DrizzleAcademyRepository } from './infrastructure/drizzle-academy.repository';
import { DrizzleMembershipRepository } from './infrastructure/drizzle-membership.repository';
import { ProvisionAcademyUseCase } from './application/provision-academy.use-case';
import { SyncMembershipUseCase } from './application/sync-membership.use-case';
import { DeleteAcademyUseCase } from './application/delete-academy.use-case';

export interface AcademyComposition {
  provisionAcademy: ProvisionAcademyUseCase;
  syncMembership: SyncMembershipUseCase;
  deleteAcademy: DeleteAcademyUseCase;
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

  return {
    provisionAcademy: new ProvisionAcademyUseCase(academyRepo),
    syncMembership: new SyncMembershipUseCase(membershipRepo),
    deleteAcademy: new DeleteAcademyUseCase(academyRepo),
  };
}
