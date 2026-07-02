/**
 * toCourseOutline (learn) — mapper extension tests (spec.md's
 * "Study-Flow Sidebar Integration"). A quiz `extraNodes` entry appears and
 * links to the quiz route ONLY when the quiz has questions.
 */

import { describe, it, expect } from 'vitest';
import { Course } from '../../../src/modules/course/domain/course.entity';
import { toCourseOutline } from '../../../src/app/dashboard/learn/_lib/course-outline';
import type { EnrolledCourseView } from '../../../src/modules/course/composition';

const now = new Date('2025-01-01T00:00:00Z');

function makeCourse(): Course {
  return new Course({
    id: 'course-1',
    academyId: 'org_A',
    slug: 'intro-to-ts',
    title: 'Intro to TypeScript',
    description: null,
    status: 'published',
    position: 1,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

function makeView(overrides: Partial<EnrolledCourseView> = {}): EnrolledCourseView {
  return {
    course: makeCourse(),
    modules: [],
    progressPercent: 0,
    isEnrolled: true,
    enrollmentId: 'enrollment-1',
    ...overrides,
  };
}

describe('toCourseOutline (learn)', () => {
  it('appends a quiz node linking to the quiz route when questionCount > 0', () => {
    const outline = toCourseOutline(makeView(), { questionCount: 3 });
    const quiz = outline.extraNodes?.find((node) => node.id === 'quiz');

    expect(quiz).toMatchObject({
      kind: 'quiz',
      href: '/dashboard/learn/courses/course-1/quiz',
    });
  });

  it('omits the quiz node when questionCount is 0', () => {
    const outline = toCourseOutline(makeView(), { questionCount: 0 });
    expect(outline.extraNodes ?? []).toHaveLength(0);
  });

  it('omits the quiz node when the quiz argument is null', () => {
    const outline = toCourseOutline(makeView(), null);
    expect(outline.extraNodes ?? []).toHaveLength(0);
  });

  it('omits the quiz node when the quiz argument is not passed at all', () => {
    const outline = toCourseOutline(makeView());
    expect(outline.extraNodes ?? []).toHaveLength(0);
  });
});
