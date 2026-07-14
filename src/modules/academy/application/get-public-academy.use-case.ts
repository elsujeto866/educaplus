import type { PublicAcademyPort, PublicAcademyView } from '../domain/ports/public-academy.port';

/**
 * GetPublicAcademyUseCase — resolves the public-safe academy projection by
 * slug for unauthenticated visitors at /a/[slug] (spec "Public-Safe Academy
 * Projection", design D2).
 *
 * Deliberately takes no TenantContext — a visitor has no orgId. Returns
 * null for unknown/unpublished/soft-deleted slugs; the caller (Server
 * Component) is responsible for rendering a 404 in that case.
 */
export class GetPublicAcademyUseCase {
  constructor(private readonly publicAcademyPort: PublicAcademyPort) {}

  async execute(slug: string): Promise<PublicAcademyView | null> {
    return this.publicAcademyPort.findBySlug(slug);
  }
}
