/**
 * computeCourseWizard — pure derivation tests. Covers spec.md's "Step
 * Derivation Purity", "Step Set and Order", "Step Completion Rules", and
 * "Current Step Derivation" requirements: empty course, a module without
 * lessons (partial), complete-but-unpublished, and published states, plus
 * the single-`current` invariant. Slice 3b extends this with the
 * `evaluacion-final` unlock (`hasQuiz` 2nd param): navigable once lessons
 * are done, `completed` once the assessment has ≥1 question, and a
 * tightened `publicar` rule that now also requires `hasQuiz`.
 */

import { describe, it, expect } from 'vitest';
import { Course } from '../../../src/modules/course/domain/course.entity';
import {
  computeCourseWizard,
  WIZARD_STEP_LABELS,
  type WizardStepStatus,
} from '../../../src/app/dashboard/courses/[courseId]/_lib/course-wizard';
import type {
  CourseDetailView,
  ModuleDetail,
} from '../../../src/modules/course/application/get-course-detail.use-case';

const now = new Date('2025-01-01T00:00:00Z');

function makeCourse(overrides: Partial<ConstructorParameters<typeof Course>[0]> = {}): Course {
  return new Course({
    id: 'course-1',
    academyId: 'org_A',
    slug: 'intro-to-ts',
    title: 'Intro to TypeScript',
    description: null,
    status: 'draft',
    position: 1,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function makeModule(lessonCount: number, overrides: Partial<ModuleDetail> = {}): ModuleDetail {
  return {
    id: `mod-${overrides.id ?? '1'}`,
    title: 'Module',
    description: null,
    position: 1,
    lessons: Array.from({ length: lessonCount }, (_, i) => ({
      id: `lesson-${i}`,
      title: `Lesson ${i}`,
      type: 'text',
      position: i,
    })),
    ...overrides,
  };
}

function makeView(overrides: Partial<CourseDetailView> = {}): CourseDetailView {
  return { course: makeCourse(), modules: [], ...overrides };
}

function statusOf(view: CourseDetailView, id: string, hasQuiz = false): WizardStepStatus {
  const wizard = computeCourseWizard(view, hasQuiz);
  const step = wizard.steps.find((s) => s.id === id);
  if (!step) throw new Error(`step ${id} not found`);
  return step.status;
}

describe('computeCourseWizard', () => {
  it('is a pure function — same input yields deep-equal output', () => {
    const view = makeView({ modules: [makeModule(1)] });
    expect(computeCourseWizard(view, false)).toEqual(computeCourseWizard(view, false));
  });

  it('derives exactly 5 steps in fixed order', () => {
    const wizard = computeCourseWizard(makeView(), false);
    expect(wizard.steps.map((s) => s.id)).toEqual([
      'datos',
      'modulos',
      'lecciones',
      'evaluacion-final',
      'publicar',
    ]);
    expect(wizard.steps.map((s) => s.label)).toEqual([
      WIZARD_STEP_LABELS.datos,
      WIZARD_STEP_LABELS.modulos,
      WIZARD_STEP_LABELS.lecciones,
      WIZARD_STEP_LABELS['evaluacion-final'],
      WIZARD_STEP_LABELS.publicar,
    ]);
  });

  it('empty course (no modules): módulos is current, lecciones/quiz/publicar pending', () => {
    const view = makeView({ modules: [] });
    const wizard = computeCourseWizard(view, false);

    expect(statusOf(view, 'datos')).toBe('completed');
    expect(statusOf(view, 'modulos')).toBe('current');
    expect(statusOf(view, 'lecciones')).toBe('upcoming');
    expect(statusOf(view, 'evaluacion-final')).toBe('upcoming');
    expect(statusOf(view, 'publicar')).toBe('upcoming');
    expect(wizard.steps.filter((s) => s.status === 'current')).toHaveLength(1);
  });

  it('a module without lessons keeps lecciones current, not complete', () => {
    const view = makeView({
      modules: [makeModule(1, { id: '1' }), makeModule(0, { id: '2' })],
    });

    expect(statusOf(view, 'modulos')).toBe('completed');
    expect(statusOf(view, 'lecciones')).toBe('current');
    expect(statusOf(view, 'evaluacion-final')).toBe('upcoming');
    expect(statusOf(view, 'publicar')).toBe('upcoming');
  });

  it('lessons done, no quiz yet: evaluación final is navigable and current, publicar pending', () => {
    const view = makeView({
      modules: [makeModule(1, { id: '1' }), makeModule(2, { id: '2' })],
    });

    expect(statusOf(view, 'datos')).toBe('completed');
    expect(statusOf(view, 'modulos')).toBe('completed');
    expect(statusOf(view, 'lecciones')).toBe('completed');
    expect(statusOf(view, 'evaluacion-final', false)).toBe('current');
    expect(statusOf(view, 'publicar', false)).toBe('upcoming');
  });

  it('lessons done and quiz has ≥1 question: evaluación final completed, publicar current', () => {
    const view = makeView({
      modules: [makeModule(1, { id: '1' }), makeModule(2, { id: '2' })],
    });

    expect(statusOf(view, 'evaluacion-final', true)).toBe('completed');
    expect(statusOf(view, 'publicar', true)).toBe('current');
  });

  it('published: all steps completed regardless of hasQuiz, no current step', () => {
    const view = makeView({
      course: makeCourse({ status: 'published', publishedAt: now }),
      modules: [makeModule(1, { id: '1' }), makeModule(2, { id: '2' })],
    });
    const wizard = computeCourseWizard(view, true);

    expect(statusOf(view, 'datos', true)).toBe('completed');
    expect(statusOf(view, 'modulos', true)).toBe('completed');
    expect(statusOf(view, 'lecciones', true)).toBe('completed');
    expect(statusOf(view, 'evaluacion-final', true)).toBe('completed');
    expect(statusOf(view, 'publicar', true)).toBe('completed');
    expect(wizard.steps.some((s) => s.status === 'current')).toBe(false);
  });

  it('evaluación final stays upcoming (never current/completed) while lessons are incomplete, regardless of hasQuiz', () => {
    const views = [makeView({ modules: [] }), makeView({ modules: [makeModule(1, { id: '1' }), makeModule(0, { id: '2' })] })];

    for (const view of views) {
      expect(statusOf(view, 'evaluacion-final', false)).toBe('upcoming');
      expect(statusOf(view, 'evaluacion-final', true)).toBe('upcoming');
    }
  });

  it('at most one step is current, across every state and hasQuiz value', () => {
    const views = [
      makeView({ modules: [] }),
      makeView({ modules: [makeModule(1, { id: '1' }), makeModule(0, { id: '2' })] }),
      makeView({ modules: [makeModule(1, { id: '1' })] }),
      makeView({
        course: makeCourse({ status: 'published', publishedAt: now }),
        modules: [makeModule(1, { id: '1' })],
      }),
    ];

    for (const view of views) {
      for (const hasQuiz of [false, true]) {
        const currentCount = computeCourseWizard(view, hasQuiz).steps.filter(
          (s) => s.status === 'current',
        ).length;
        expect(currentCount).toBeLessThanOrEqual(1);
      }
    }
  });

  it('every step carries an href — evaluación final links to the quiz builder route', () => {
    const view = makeView({ modules: [makeModule(1)] });
    const wizard = computeCourseWizard(view, false);

    for (const step of wizard.steps) {
      if (step.id === 'evaluacion-final') {
        expect(step.href).toBe(`/dashboard/courses/${view.course.id}/quiz`);
      } else {
        expect(step.href).toBe(`/dashboard/courses/${view.course.id}`);
      }
    }
  });
});
