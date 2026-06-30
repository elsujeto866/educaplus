import { CourseNotPublishedError } from './errors';
import type { PublicationStatus } from './value-objects/publication-status.vo';

export interface EnrollmentProps {
  id: string;
  courseId: string;
  academyId: string;
  clerkUserId: string;
  enrolledAt: Date;
  completedAt?: Date | null;
}

/**
 * Enrollment aggregate root.
 *
 * Invariant: a learner may only be enrolled in a published course.
 * Use the static factory `Enrollment.enroll()` when creating new enrollments
 * so this invariant is enforced at the domain boundary.
 *
 * Duplicate-enrollment detection (same courseId + clerkUserId) is enforced by
 * the use-case layer via EnrollmentRepository.existsByCourseAndUser().
 *
 * Pure TS — zero infrastructure imports.
 */
export class Enrollment {
  readonly id: string;
  readonly courseId: string;
  readonly academyId: string;
  readonly clerkUserId: string;
  readonly enrolledAt: Date;
  readonly completedAt: Date | null;

  constructor(props: EnrollmentProps) {
    if (!props.id) throw new Error('Enrollment: id is required');
    if (!props.courseId) throw new Error('Enrollment: courseId is required');
    if (!props.academyId) throw new Error('Enrollment: academyId is required');
    if (!props.clerkUserId) throw new Error('Enrollment: clerkUserId is required');

    this.id = props.id;
    this.courseId = props.courseId;
    this.academyId = props.academyId;
    this.clerkUserId = props.clerkUserId;
    this.enrolledAt = props.enrolledAt;
    this.completedAt = props.completedAt ?? null;
  }

  /**
   * Domain factory — enforces the published-course invariant before enrolling.
   * Throws CourseNotPublishedError when courseStatus is 'draft'.
   */
  static enroll(props: EnrollmentProps, courseStatus: PublicationStatus): Enrollment {
    if (courseStatus !== 'published') {
      throw new CourseNotPublishedError(props.courseId);
    }
    return new Enrollment(props);
  }

  get isCompleted(): boolean {
    return this.completedAt !== null;
  }

  /** Returns a new immutable Enrollment instance with completedAt recorded. */
  complete(at: Date = new Date()): Enrollment {
    return new Enrollment({ ...this, completedAt: at });
  }
}
