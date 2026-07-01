import type { CourseDetailView } from '@/modules/course/composition';
import type { CourseOutline } from '@/shared/ui/organisms/course-outline-sidebar';

/**
 * Maps the already-fetched authoring `CourseDetailView` into a
 * `CourseOutline` for `CourseOutlineNav`. No new data-fetching: reuses the
 * view-model `CourseDetailPage` already read via `getCourseDetail`.
 * Authoring has no lesson-editor route yet (slice 2), so lessons omit
 * `href` and render as plain labels.
 */
export function toCourseOutline(view: CourseDetailView): CourseOutline {
  return {
    courseId: view.course.id,
    courseTitle: view.course.title,
    courseHref: `/dashboard/courses/${view.course.id}`,
    modules: view.modules.map((mod) => ({
      id: mod.id,
      title: mod.title,
      lessons: mod.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
      })),
    })),
  };
}
