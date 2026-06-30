import { and, count, eq } from 'drizzle-orm';
import { withTenant } from '@/shared/infrastructure/db/with-tenant';
import {
  courseModules,
  lessons,
  lessonProgress,
} from '@/shared/infrastructure/db/schema/course.schema';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import type {
  CourseProgress,
  ModuleProgress,
  ProgressQuery,
} from '../domain/ports/progress-query';

/**
 * Drizzle implementation of ProgressQuery.
 *
 * Computes derived progress metrics at query-time via COUNT aggregates inside
 * withTenant — RLS applies to every query. No progress data is stored redundantly.
 *
 * Indexes that keep these queries fast at MVP scale:
 *   - lesson_progress: unique (enrollment_id, lesson_id)
 *   - lessons: (module_id, position)
 *   - course_modules: (course_id, position)
 */
export class DrizzleProgressQuery implements ProgressQuery {
  /**
   * Returns course-level progress for a given enrollment.
   *
   * Counts lessons across ALL modules of the course, then counts how many
   * of those lessons have a corresponding lesson_progress row for this enrollment.
   */
  async getCourseProgress(
    ctx: TenantContext,
    enrollmentId: string,
    courseId: string,
  ): Promise<CourseProgress> {
    return withTenant(ctx, async (tx) => {
      // Total lessons in the course (all modules)
      const [totalResult] = await tx
        .select({ n: count() })
        .from(lessons)
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(eq(courseModules.courseId, courseId));

      // Completed lessons for this enrollment in this course
      const [completedResult] = await tx
        .select({ n: count() })
        .from(lessonProgress)
        .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollmentId),
            eq(courseModules.courseId, courseId),
          ),
        );

      const total = totalResult?.n ?? 0;
      const completed = completedResult?.n ?? 0;
      const pct =
        total === 0 ? 0 : Math.round((completed / total) * 10000) / 100;

      return {
        enrollmentId,
        courseId,
        completedLessons: completed,
        totalLessons: total,
        percentComplete: pct,
      };
    });
  }

  /**
   * Returns module-level progress for a given enrollment.
   *
   * Counts lessons in the module and how many have been completed in this enrollment.
   */
  async getModuleProgress(
    ctx: TenantContext,
    enrollmentId: string,
    moduleId: string,
  ): Promise<ModuleProgress> {
    return withTenant(ctx, async (tx) => {
      // Total lessons in the module
      const [totalResult] = await tx
        .select({ n: count() })
        .from(lessons)
        .where(eq(lessons.moduleId, moduleId));

      // Completed lessons for this enrollment in this module
      const [completedResult] = await tx
        .select({ n: count() })
        .from(lessonProgress)
        .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollmentId),
            eq(lessons.moduleId, moduleId),
          ),
        );

      const total = totalResult?.n ?? 0;
      const completed = completedResult?.n ?? 0;
      const pct =
        total === 0 ? 0 : Math.round((completed / total) * 10000) / 100;

      return {
        moduleId,
        completedLessons: completed,
        totalLessons: total,
        percentComplete: pct,
      };
    });
  }
}
