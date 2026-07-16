import type { PublicAcademyPort, PublicAcademyView } from '../domain/ports/public-academy.port';

/**
 * ListPublicAcademiesUseCase — returns the public-safe projection of every
 * published academy for the unauthenticated root directory (spec "Public
 * Academy Discovery"). Deliberately takes no TenantContext — a visitor has no
 * orgId. Row visibility is enforced by RLS's `public_read` policy (design D2),
 * not here; this use-case only forwards the port's result.
 */
export class ListPublicAcademiesUseCase {
  constructor(private readonly publicAcademyPort: PublicAcademyPort) {}

  async execute(): Promise<PublicAcademyView[]> {
    return this.publicAcademyPort.findAllPublished();
  }
}
