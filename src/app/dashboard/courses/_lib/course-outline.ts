import type { CourseDetailView } from '@/modules/course/composition';
import type { CourseOutline } from '@/shared/ui/organisms/course-outline-sidebar';
import { WIZARD_STEP_LABELS } from '../[courseId]/_lib/course-wizard';

/**
 * Maps the already-fetched authoring `CourseDetailView` into a
 * `CourseOutline` for `CourseOutlineNav`. No new data-fetching: reuses the
 * view-model `CourseDetailPage` already read via `getCourseDetail`.
 * Lessons link to the existing lesson-editor route, and two `extraNodes`
 * mirror the guided wizard's remaining steps (locked final-quiz, publish).
 */
export function toCourseOutline(view: CourseDetailView): CourseOutline {
  const courseHref = `/dashboard/courses/${view.course.id}`;

  return {
    courseId: view.course.id,
    courseTitle: view.course.title,
    courseHref,
    modules: view.modules.map((mod) => ({
      id: mod.id,
      title: mod.title,
      lessons: mod.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        href: `${courseHref}/lessons/${lesson.id}`,
      })),
    })),
    extraNodes: [
      { id: 'final-quiz', label: WIZARD_STEP_LABELS['evaluacion-final'], kind: 'quiz' },
      { id: 'publish', label: WIZARD_STEP_LABELS.publicar, kind: 'publish', href: courseHref },
    ],
  };
}
