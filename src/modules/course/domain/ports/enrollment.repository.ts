import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Enrollment } from '../enrollment.entity';

/**
 * Port: EnrollmentRepository
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 * The unique constraint (course_id, clerk_user_id) is reflected by
 * existsByCourseAndUser which the use-case calls to detect duplicates before
 * calling create.
 */
export interface EnrollmentRepository {
  create(ctx: TenantContext, enrollment: Enrollment): Promise<void>;

  findById(ctx: TenantContext, id: string): Promise<Enrollment | null>;

  findByCourseAndUser(
    ctx: TenantContext,
    courseId: string,
    clerkUserId: string,
  ): Promise<Enrollment | null>;

  /** Returns all enrollments for a course. */
  findByCourse(ctx: TenantContext, courseId: string): Promise<Enrollment[]>;

  /** Persists completedAt update after course-% reaches 100. */
  update(ctx: TenantContext, enrollment: Enrollment): Promise<void>;

  /** True when (courseId, clerkUserId) pair already exists — used to throw DuplicateEnrollmentError. */
  existsByCourseAndUser(ctx: TenantContext, courseId: string, clerkUserId: string): Promise<boolean>;
}
