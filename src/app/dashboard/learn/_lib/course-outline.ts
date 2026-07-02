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
 *
 * `quiz` (Slice 4b-ii): optional `{questionCount}`, read separately by the
 * caller via `GetAssessmentUseCase` (kept out of `EnrolledCourseView` to
 * leave 4b-i's backend frozen). Appends a single `extraNodes` entry of
 * kind `quiz` linking to the take-quiz route ONLY when `questionCount>0`
 * (spec.md's "Empty quiz has no entry point").
 */
export function toCourseOutline(
  view: EnrolledCourseView,
  quiz?: { questionCount: number } | null,
): CourseOutline {
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
    ...(quiz && quiz.questionCount > 0
      ? {
          extraNodes: [
            {
              id: 'quiz',
              label: 'Evaluación final',
              href: `/dashboard/learn/courses/${view.course.id}/quiz`,
              kind: 'quiz' as const,
            },
          ],
        }
      : {}),
  };
}
