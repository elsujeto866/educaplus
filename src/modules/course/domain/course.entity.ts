import type { PublicationStatus } from './value-objects/publication-status.vo';
import { Slug } from './value-objects/slug.vo';

export interface CourseProps {
  id: string;
  academyId: string;
  slug: string;
  title: string;
  description?: string | null;
  status: PublicationStatus;
  position: number;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Course aggregate root.
 *
 * Slug uniqueness within an academy is enforced by the use-case layer via
 * CourseRepository.existsBySlug — not here. The entity only validates structural
 * correctness of the slug format via Slug.create().
 *
 * Pure TS — zero infrastructure imports.
 */
export class Course {
  readonly id: string;
  readonly academyId: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: PublicationStatus;
  readonly position: number;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CourseProps) {
    if (!props.id) throw new Error('Course: id is required');
    if (!props.academyId) throw new Error('Course: academyId is required');
    if (!props.slug) throw new Error('Course: slug is required');
    if (!props.title) throw new Error('Course: title is required');

    this.id = props.id;
    this.academyId = props.academyId;
    this.slug = props.slug;
    this.title = props.title;
    this.description = props.description ?? null;
    this.status = props.status;
    this.position = props.position;
    this.publishedAt = props.publishedAt ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get isPublished(): boolean {
    return this.status === 'published';
  }

  /**
   * Generates a slug candidate from a course title.
   * Does NOT enforce uniqueness — callers must verify via CourseRepository.existsBySlug
   * and throw SlugConflictError when a conflict is detected.
   */
  static slugFromTitle(title: string): string {
    return Slug.fromName(title).value;
  }

  /** Returns a new Course instance with status set to 'published' and publishedAt recorded. */
  publish(at: Date = new Date()): Course {
    return new Course({
      ...this,
      status: 'published',
      publishedAt: at,
      updatedAt: at,
    });
  }

  /** Returns a new Course instance with status set to 'draft' and publishedAt cleared. */
  unpublish(at: Date = new Date()): Course {
    return new Course({
      ...this,
      status: 'draft',
      publishedAt: null,
      updatedAt: at,
    });
  }
}
