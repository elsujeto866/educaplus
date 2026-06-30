import type { TenantContext } from '@/shared/kernel/tenant-context';
import { Enrollment } from '../domain/enrollment.entity';
import { DuplicateEnrollmentError } from '../domain/errors';
import type { CourseRepository } from '../domain/ports/course.repository';
import type { EnrollmentRepository } from '../domain/ports/enrollment.repository';

export interface EnrollLearnerInput {
  /** Caller-supplied UUID for the new enrollment. */
  id: string;
  courseId: string;
  academyId: string;
  clerkUserId: string;
}

/**
 * EnrollLearnerUseCase
 *
 * Enrolls a learner in a published course. Enforces two domain invariants:
 *   1. The course must be published — Enrollment.enroll() throws CourseNotPublishedError.
 *   2. Duplicate enrollment on (courseId, clerkUserId) throws DuplicateEnrollmentError.
 *
 * No role guard — learners can self-enroll; the course-published check is the
 * only authorization boundary.
 */
export class EnrollLearnerUseCase {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
  ) {}

  async execute(ctx: TenantContext, input: EnrollLearnerInput): Promise<Enrollment> {
    const course = await this.courseRepo.findById(ctx, input.courseId);
    if (!course) throw new Error(`Course "${input.courseId}" not found`);

    const alreadyEnrolled = await this.enrollmentRepo.existsByCourseAndUser(
      ctx,
      input.courseId,
      input.clerkUserId,
    );
    if (alreadyEnrolled) {
      throw new DuplicateEnrollmentError(input.courseId, input.clerkUserId);
    }

    const now = new Date();
    // Enrollment.enroll() throws CourseNotPublishedError when course is draft.
    const enrollment = Enrollment.enroll(
      {
        id: input.id,
        courseId: input.courseId,
        academyId: input.academyId,
        clerkUserId: input.clerkUserId,
        enrolledAt: now,
        completedAt: null,
      },
      course.status,
    );

    await this.enrollmentRepo.create(ctx, enrollment);
    return enrollment;
  }
}
