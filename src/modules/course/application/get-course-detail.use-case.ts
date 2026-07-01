import type { TenantContext } from '@/shared/kernel/tenant-context';
import type { Course } from '../domain/course.entity';
import type { LessonType } from '../domain/value-objects/lesson-type.vo';
import type { CourseRepository } from '../domain/ports/course.repository';
import type { CourseModuleRepository } from '../domain/ports/course-module.repository';
import type { LessonRepository } from '../domain/ports/lesson.repository';

export interface LessonSummary {
  id: string;
  title: string;
  type: LessonType;
  position: number;
}

export interface ModuleDetail {
  id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: LessonSummary[];
}

export interface CourseDetailView {
  course: Course;
  modules: ModuleDetail[];
}

/**
 * GetCourseDetailUseCase — reads a single course's full authoring view model:
 * the course plus its modules (ordered by position), each with an ordered
 * list of lesson summaries.
 *
 * Read-only: no `assertRole` guard — page-level gating decides who may reach
 * this use-case. Returns `null` when the course does not exist OR belongs to
 * a different tenant (courseRepo.findById is already RLS/ctx-scoped) — this
 * is the single not-found/cross-tenant path, no data leak.
 */
export class GetCourseDetailUseCase {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly moduleRepo: CourseModuleRepository,
    private readonly lessonRepo: LessonRepository,
  ) {}

  async execute(ctx: TenantContext, courseId: string): Promise<CourseDetailView | null> {
    const course = await this.courseRepo.findById(ctx, courseId);
    if (!course) return null;

    const modules = await this.moduleRepo.findByCourse(ctx, courseId);

    const moduleDetails: ModuleDetail[] = await Promise.all(
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
          })),
        };
      }),
    );

    return { course, modules: moduleDetails };
  }
}
