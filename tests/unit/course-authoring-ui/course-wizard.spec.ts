/**
 * computeCourseWizard — pure derivation tests. Covers spec.md's "Step
 * Derivation Purity", "Step Set and Order", "Step Completion Rules", and
 * "Current Step Derivation" requirements: empty course, a module without
 * lessons (partial), complete-but-unpublished, and published states, plus
 * the single-`current` invariant and the locked-quiz-never-current rule.
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

function statusOf(view: CourseDetailView, id: string): WizardStepStatus {
  const wizard = computeCourseWizard(view);
  const step = wizard.steps.find((s) => s.id === id);
  if (!step) throw new Error(`step ${id} not found`);
  return step.status;
}

describe('computeCourseWizard', () => {
  it('is a pure function — same input yields deep-equal output', () => {
    const view = makeView({ modules: [makeModule(1)] });
    expect(computeCourseWizard(view)).toEqual(computeCourseWizard(view));
  });

  it('derives exactly 5 steps in fixed order', () => {
    const wizard = computeCourseWizard(makeView());
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

  it('empty course (no modules): módulos is current, lecciones/publicar pending, quiz locked', () => {
    const view = makeView({ modules: [] });
    const wizard = computeCourseWizard(view);

    expect(statusOf(view, 'datos')).toBe('completed');
    expect(statusOf(view, 'modulos')).toBe('current');
    expect(statusOf(view, 'lecciones')).toBe('upcoming');
    expect(statusOf(view, 'evaluacion-final')).toBe('locked');
    expect(statusOf(view, 'publicar')).toBe('upcoming');
    expect(wizard.steps.filter((s) => s.status === 'current')).toHaveLength(1);
  });

  it('a module without lessons keeps lecciones current, not complete', () => {
    const view = makeView({
      modules: [makeModule(1, { id: '1' }), makeModule(0, { id: '2' })],
    });

    expect(statusOf(view, 'modulos')).toBe('completed');
    expect(statusOf(view, 'lecciones')).toBe('current');
    expect(statusOf(view, 'publicar')).toBe('upcoming');
  });

  it('complete but unpublished: datos/módulos/lecciones completed, publicar is current', () => {
    const view = makeView({
      modules: [makeModule(1, { id: '1' }), makeModule(2, { id: '2' })],
    });

    expect(statusOf(view, 'datos')).toBe('completed');
    expect(statusOf(view, 'modulos')).toBe('completed');
    expect(statusOf(view, 'lecciones')).toBe('completed');
    expect(statusOf(view, 'evaluacion-final')).toBe('locked');
    expect(statusOf(view, 'publicar')).toBe('current');
  });

  it('published: all actionable steps completed, quiz remains locked, no current step', () => {
    const view = makeView({
      course: makeCourse({ status: 'published', publishedAt: now }),
      modules: [makeModule(1, { id: '1' }), makeModule(2, { id: '2' })],
    });
    const wizard = computeCourseWizard(view);

    expect(statusOf(view, 'datos')).toBe('completed');
    expect(statusOf(view, 'modulos')).toBe('completed');
    expect(statusOf(view, 'lecciones')).toBe('completed');
    expect(statusOf(view, 'evaluacion-final')).toBe('locked');
    expect(statusOf(view, 'publicar')).toBe('completed');
    expect(wizard.steps.some((s) => s.status === 'current')).toBe(false);
  });

  it('evaluación final is always locked, never current, across every state', () => {
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
      expect(statusOf(view, 'evaluacion-final')).toBe('locked');
    }
  });

  it('at most one step is current, across every state', () => {
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
      const currentCount = computeCourseWizard(view).steps.filter(
        (s) => s.status === 'current',
      ).length;
      expect(currentCount).toBeLessThanOrEqual(1);
    }
  });

  it('non-locked steps carry an href to the course detail page', () => {
    const view = makeView({ modules: [makeModule(1)] });
    const wizard = computeCourseWizard(view);

    for (const step of wizard.steps) {
      if (step.id === 'evaluacion-final') {
        expect(step.href).toBeUndefined();
      } else {
        expect(step.href).toBe(`/dashboard/courses/${view.course.id}`);
      }
    }
  });
});
