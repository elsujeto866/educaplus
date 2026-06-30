/**
 * PublicationStatus — visibility state for a course.
 *
 * 'draft'     → not visible to learners; enrollment blocked.
 * 'published' → visible; enrollment open.
 *
 * Transitions are managed by Course.publish() / Course.unpublish() to ensure
 * the publishedAt timestamp stays consistent.
 *
 * Pure TS — zero imports.
 */
export type PublicationStatus = 'draft' | 'published';

const VALID: ReadonlySet<string> = new Set<PublicationStatus>(['draft', 'published']);

/**
 * Validates and narrows a raw string to PublicationStatus.
 * Throws when the value is not a member of the closed set.
 */
export function parsePublicationStatus(value: string): PublicationStatus {
  if (!VALID.has(value)) {
    throw new Error(`Invalid publication status "${value}": must be "draft" or "published"`);
  }
  return value as PublicationStatus;
}
