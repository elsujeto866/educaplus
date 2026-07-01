import type { EnrolledCourseView } from '@/modules/course/composition';
import type { CourseOutline } from '@/shared/ui/organisms/course-outline-sidebar';

/**
 * Maps the already-fetched study `EnrolledCourseView` into a
 * `CourseOutline` for `CourseOutlineNav`. No new data-fetching: reuses the
 * view-model `CourseViewerPage` already read via `getEnrolledCourse`.
 *
 * Lesson `href` is attached ONLY when `view.isEnrolled` is true. Non-enrolled
 * learners still see the syllabus preview (modules + lesson titles), but as
 * href-less labels — mirroring the main pane's enroll-gate and the
 * authoring-mode behavior — so no lesson link bounces a non-enrolled
 * visitor back to the lesson-viewer's redirect guard.
 */
export function toCourseOutline(view: EnrolledCourseView): CourseOutline {
  return {
    courseId: view.course.id,
    courseTitle: view.course.title,
    courseHref: `/dashboard/learn/courses/${view.course.id}`,
    modules: view.modules.map((mod) => ({
      id: mod.id,
      title: mod.title,
      lessons: mod.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        ...(view.isEnrolled
          ? { href: `/dashboard/learn/courses/${view.course.id}/lessons/${lesson.id}` }
          : {}),
        completed: lesson.completed,
      })),
    })),
  };
}
