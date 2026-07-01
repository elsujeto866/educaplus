import type { CourseDetailView } from '@/modules/course/composition';

export type WizardStepStatus = 'completed' | 'current' | 'locked' | 'upcoming';

export interface WizardStep {
  id: string;
  label: string;
  status: WizardStepStatus;
  href?: string;
}

export interface CourseWizard {
  steps: WizardStep[];
}

/** Single source of truth for wizard step labels — reused by the mapper's
 *  `extraNodes` (final-quiz, publish) so the stepper and the sidebar never
 *  drift apart. */
export const WIZARD_STEP_LABELS = {
  datos: 'Datos',
  modulos: 'Módulos',
  lecciones: 'Lecciones',
  'evaluacion-final': 'Evaluación final',
  publicar: 'Publicar',
} as const;

function hasModules(view: CourseDetailView): boolean {
  return view.modules.length > 0;
}

function everyModuleHasLesson(view: CourseDetailView): boolean {
  return hasModules(view) && view.modules.every((mod) => mod.lessons.length > 0);
}

function isPublished(view: CourseDetailView): boolean {
  return view.course.status === 'published';
}

/**
 * Pure derivation of the 5-step authoring wizard from the already-fetched
 * `CourseDetailView` — no domain/application/infra import, no side effects.
 * Delivery `_lib`, mirrors the sibling `course-outline.ts` mapper.
 *
 * `hasQuiz` (slice 3b) is the caller-computed `(assessment?.questions.length
 * ?? 0) >= 1` flag — this function stays a pure derivation with zero
 * data-fetching of its own.
 */
export function computeCourseWizard(view: CourseDetailView, hasQuiz: boolean): CourseWizard {
  const modulesDone = hasModules(view);
  const lessonsDone = everyModuleHasLesson(view);
  const published = isPublished(view);
  const detailHref = `/dashboard/courses/${view.course.id}`;
  const quizHref = `/dashboard/courses/${view.course.id}/quiz`;

  const steps: WizardStep[] = [
    {
      id: 'datos',
      label: WIZARD_STEP_LABELS.datos,
      status: 'completed',
      href: detailHref,
    },
    {
      id: 'modulos',
      label: WIZARD_STEP_LABELS.modulos,
      status: modulesDone ? 'completed' : 'current',
      href: detailHref,
    },
    {
      id: 'lecciones',
      label: WIZARD_STEP_LABELS.lecciones,
      status: !modulesDone ? 'upcoming' : lessonsDone ? 'completed' : 'current',
      href: detailHref,
    },
    {
      id: 'evaluacion-final',
      label: WIZARD_STEP_LABELS['evaluacion-final'],
      status: !lessonsDone ? 'upcoming' : hasQuiz ? 'completed' : 'current',
      href: quizHref,
    },
    {
      id: 'publicar',
      label: WIZARD_STEP_LABELS.publicar,
      status: published ? 'completed' : lessonsDone && hasQuiz ? 'current' : 'upcoming',
      href: detailHref,
    },
  ];

  return { steps };
}
