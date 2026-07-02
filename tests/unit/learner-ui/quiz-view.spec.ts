/**
 * toQuizView — SECURITY-CRITICAL unit tests (spec.md's "Result
 * Non-Disclosure" requirement). `AssessmentView.questions` carries
 * `correctOptionId` (the quiz builder needs it); the student-facing quiz
 * view MUST strip it before the payload ever crosses into the 'use
 * client' `QuizRunner` boundary. This test asserts the mapper's output —
 * including its JSON-serialized form — never contains the key, while
 * still preserving every field the runner needs to render.
 */

import { describe, it, expect } from 'vitest';
import { toQuizView } from '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_lib/quiz-view';
import type { AssessmentView } from '../../../src/modules/course/composition';

function makeAssessment(overrides: Partial<AssessmentView> = {}): AssessmentView {
  return {
    id: 'assess-1',
    courseId: 'course-1',
    title: 'Evaluación final',
    passingScore: 70,
    questions: [
      {
        type: 'single',
        id: 'q-1',
        prompt: '2 + 2?',
        options: [
          { id: 'opt-1', label: '3' },
          { id: 'opt-2', label: '4' },
        ],
        correctOptionId: 'opt-2',
      },
      {
        type: 'single',
        id: 'q-2',
        prompt: '3 + 3?',
        options: [
          { id: 'opt-3', label: '5' },
          { id: 'opt-4', label: '6' },
        ],
        correctOptionId: 'opt-4',
      },
    ],
    ...overrides,
  };
}

describe('toQuizView', () => {
  it('NEVER includes correctOptionId in the serialized output, for any question', () => {
    const view = toQuizView(makeAssessment());
    const serialized = JSON.stringify(view);

    expect(serialized).not.toContain('correctOptionId');
  });

  it('preserves quiz id/title/courseId and each question id/prompt/options in order', () => {
    const view = toQuizView(makeAssessment());

    expect(view.id).toBe('assess-1');
    expect(view.courseId).toBe('course-1');
    expect(view.title).toBe('Evaluación final');
    expect(view.questions).toEqual([
      {
        id: 'q-1',
        prompt: '2 + 2?',
        options: [
          { id: 'opt-1', label: '3' },
          { id: 'opt-2', label: '4' },
        ],
      },
      {
        id: 'q-2',
        prompt: '3 + 3?',
        options: [
          { id: 'opt-3', label: '5' },
          { id: 'opt-4', label: '6' },
        ],
      },
    ]);
  });

  it('maps an empty questions array to an empty QuizView', () => {
    const view = toQuizView(makeAssessment({ questions: [] }));
    expect(view.questions).toEqual([]);
  });
});
