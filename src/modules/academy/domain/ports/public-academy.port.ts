/**
 * Port: PublicAcademyPort (PUBLIC / UNTENANTED path)
 *
 * Resolves the public-safe projection of an academy by slug, for
 * unauthenticated visitors at /a/[slug] (spec "Public-Safe Academy
 * Projection"). Implemented via withPublicRole() (SET LOCAL ROLE
 * academy_public) — never withTenant() and never getTenantContext(). RLS's
 * `public_read` policy on `academies` gates rows to published, non-deleted
 * academies; the column-level GRANT (id, name, slug, is_public, deleted_at)
 * plus this port's explicit projection gate which fields ever leave the DB.
 *
 * Deliberately separate from AcademyRepository (the admin/tenant port) so a
 * use-case that only depends on this port physically cannot reach
 * tenant-internal fields (billing, settings, member lists).
 */
export interface PublicAcademyView {
  id: string;
  name: string;
  slug: string;
}

export interface PublicAcademyPort {
  /** Null when the slug does not resolve to a published, non-deleted academy. */
  findBySlug(slug: string): Promise<PublicAcademyView | null>;
  /**
   * Every published, non-deleted academy — powers the public directory at the
   * root landing. RLS's `public_read` policy scopes the rows; the empty array
   * is a valid result (no public academies yet).
   */
  findAllPublished(): Promise<PublicAcademyView[]>;
}
