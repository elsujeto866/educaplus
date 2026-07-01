import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Course } from '../domain/course.entity';
import type { LessonType } from '../domain/value-objects/lesson-type.vo';
import type { CourseRepository } from '../domain/ports/course.repository';
import type { CourseModuleRepository } from '../domain/ports/course-module.repository';
import type { LessonRepository } from '../domain/ports/lesson.repository';
import type { EnrollmentRepository } from '../domain/ports/enrollment.repository';
import type { LessonProgressRepository } from '../domain/ports/lesson-progress.repository';
import type { ProgressQuery } from '../domain/ports/progress-query';

export interface EnrolledLessonView {
  id: string;
  title: string;
  type: LessonType;
  position: number;
  completed: boolean;
}

export interface EnrolledModuleView {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: EnrolledLessonView[];
}

export interface EnrolledCourseView {
  course: Course;
  modules: EnrolledModuleView[];
  progressPercent: number;
  isEnrolled: boolean;
  enrollmentId: string | null;
}

/**
 * GetEnrolledCourseUseCase — reads a learner's course view, overlaying
 * per-lesson completion and course-wide progress when the caller is enrolled.
 *
 * Read-only: no `assertRole` guard. Returns `null` when the course does not
 * exist OR belongs to a different tenant (courseRepo.findById is already
 * RLS/ctx-scoped) — mirrors GetCourseDetailUseCase's not-found contract.
 *
 * When the caller is NOT enrolled, modules/lessons are still returned (course
 * info + syllabus for the enroll CTA) but every lesson's `completed` is false
 * and `progressPercent` is 0 — no enrollment/progress row exists to read.
 */
export class GetEnrolledCourseUseCase {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly moduleRepo: CourseModuleRepository,
    private readonly lessonRepo: LessonRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly lessonProgressRepo: LessonProgressRepository,
    private readonly progressQuery: ProgressQuery,
  ) {}

  async execute(ctx: TenantContext, courseId: string): Promise<EnrolledCourseView | null> {
    const course = await this.courseRepo.findById(ctx, courseId);
    if (!course) return null;

    const enrollment = await this.enrollmentRepo.findByCourseAndUser(ctx, courseId, ctx.userId);

    let completedLessonIds = new Set<string>();
    let progressPercent = 0;

    if (enrollment) {
      const progressRecords = await this.lessonProgressRepo.findByEnrollment(ctx, enrollment.id);
      completedLessonIds = new Set(progressRecords.map((p) => p.lessonId));

      const courseProgress = await this.progressQuery.getCourseProgress(
        ctx,
        enrollment.id,
        courseId,
      );
      progressPercent = courseProgress.percentComplete;
    }

    const modules = await this.moduleRepo.findByCourse(ctx, courseId);

    const moduleViews: EnrolledModuleView[] = await Promise.all(
      modules.map(async (mod) => {
        const lessons = await this.lessonRepo.findByModule(ctx, mod.id);
        return {
          id: mod.id,
          title: mod.title,
          description: mod.description,
          position: mod.position,
          lessons: lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            type: lesson.type,
            position: lesson.position,
            completed: completedLessonIds.has(lesson.id),
          })),
        };
      }),
    );

    return {
      course,
      modules: moduleViews,
      progressPercent,
      isEnrolled: enrollment !== null,
      enrollmentId: enrollment?.id ?? null,
    };
  }
}
