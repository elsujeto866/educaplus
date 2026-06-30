import type { TenantContext } from '@/shared/kernel/tenant-context';

/**
 * Derived progress snapshot for a course enrollment.
 * Computed at query-time via aggregate SQL — not stored.
 */
export interface CourseProgress {
  readonly enrollmentId: string;
  readonly courseId: string;
  readonly completedLessons: number;
  readonly totalLessons: number;
  /** 0–100, rounded to two decimal places by the infra adapter. */
  readonly percentComplete: number;
}

/**
 * Derived progress snapshot for a single module within an enrollment.
 */
export interface ModuleProgress {
  readonly moduleId: string;
  readonly completedLessons: number;
  readonly totalLessons: number;
  readonly percentComplete: number;
}

/**
 * Port: ProgressQuery
 *
 * Read-only port for derived progress metrics — NOT an aggregate root.
 * The Drizzle adapter runs raw aggregate SQL inside withTenant so RLS applies.
 *
 * This port is separated from LessonProgressRepository because it serves
 * read-projection queries (COUNT aggregates) rather than entity persistence.
 * The MarkLessonCompleteUseCase calls getCourseProgress after upserting a
 * progress row to decide whether to set enrollment.completed_at.
 *
 * All methods receive TenantContext first — explicit threading, no globals.
 */
export interface ProgressQuery {
  getCourseProgress(
    ctx: TenantContext,
    enrollmentId: string,
    courseId: string,
  ): Promise<CourseProgress>;

  getModuleProgress(
    ctx: TenantContext,
    enrollmentId: string,
    moduleId: string,
  ): Promise<ModuleProgress>;
}
