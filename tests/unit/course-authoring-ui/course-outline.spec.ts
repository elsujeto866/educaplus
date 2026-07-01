/**
 * toCourseOutline — mapper extension tests. Covers spec.md's "Authoring
 * Lesson Nodes Are Clickable" (lesson href shape) and "Wizard populates
 * extraNodes with quiz + publish" scenarios.
 */

import { describe, it, expect } from 'vitest';
import { Course } from '../../../src/modules/course/domain/course.entity';
import { toCourseOutline } from '../../../src/app/dashboard/courses/_lib/course-outline';
import { WIZARD_STEP_LABELS } from '../../../src/app/dashboard/courses/[courseId]/_lib/course-wizard';
import type { CourseDetailView } from '../../../src/modules/course/application/get-course-detail.use-case';

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

function makeView(overrides: Partial<CourseDetailView> = {}): CourseDetailView {
  return {
    course: makeCourse(),
    modules: [
      {
        id: 'mod-1',
        title: 'Module 1',
        description: null,
        position: 1,
        lessons: [{ id: 'lesson-1', title: 'Lesson 1', type: 'text', position: 1 }],
      },
    ],
    ...overrides,
  };
}

describe('toCourseOutline', () => {
  it('gives each authoring lesson an href to the lesson-editor route', () => {
    const outline = toCourseOutline(makeView());

    expect(outline.modules[0]?.lessons[0]?.href).toBe(
      '/dashboard/courses/course-1/lessons/lesson-1',
    );
  });

  it('appends a locked final-quiz node with no href and kind "quiz"', () => {
    const outline = toCourseOutline(makeView());
    const quiz = outline.extraNodes?.find((node) => node.id === 'final-quiz');

    expect(quiz).toMatchObject({ label: WIZARD_STEP_LABELS['evaluacion-final'], kind: 'quiz' });
    expect(quiz?.href).toBeUndefined();
  });

  it('appends a publish node with an href to the course detail page and kind "publish"', () => {
    const outline = toCourseOutline(makeView());
    const publish = outline.extraNodes?.find((node) => node.id === 'publish');

    expect(publish).toMatchObject({
      label: WIZARD_STEP_LABELS.publicar,
      kind: 'publish',
      href: '/dashboard/courses/course-1',
    });
  });
});
