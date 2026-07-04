/**
 * toAttemptView — SECURITY-CRITICAL unit tests (spec.md / design Decision 1's
 * security note: "the in-progress read-model MUST strip correctOptionId
 * before it reaches the browser"). `SimulatorAttempt.frozenQuestions`
 * carries `correctOptionId` (the server needs it to score); the
 * student-facing attempt view MUST strip it before the payload ever
 * crosses into the 'use client' exam runner. Mirrors
 * `tests/unit/learner-ui/quiz-view.spec.ts`'s non-disclosure assertion.
 */

import { describe, it, expect } from 'vitest';
import {
  toAttemptView,
  type AttemptViewSource,
} from '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/_lib/attempt-view';

function makeAttempt(overrides: Partial<AttemptViewSource> = {}): AttemptViewSource {
  return {
    id: 'attempt-1',
    simulatorId: 'sim-1',
    status: 'in_progress',
    frozenQuestions: [
      {
        id: 'q-1',
        prompt: '2 + 2?',
        options: [
          { id: 'opt-1', label: '3' },
          { id: 'opt-2', label: '4' },
        ],
        correctOptionId: 'opt-2',
      },
      {
        id: 'q-2',
        prompt: '3 + 3?',
        options: [
          { id: 'opt-3', label: '5' },
          { id: 'opt-4', label: '6' },
        ],
        correctOptionId: 'opt-4',
      },
    ],
    deadlineAt: new Date('2025-06-01T10:30:00Z'),
    score: null,
    passed: null,
    ...overrides,
  };
}

describe('toAttemptView', () => {
  it('NEVER includes correctOptionId in the serialized output, for any question, in ANY status', () => {
    const inProgress = toAttemptView(makeAttempt({ status: 'in_progress' }));
    const submitted = toAttemptView(
      makeAttempt({ status: 'submitted', score: 100, passed: true }),
    );
    const expired = toAttemptView(makeAttempt({ status: 'expired', score: 0, passed: false }));

    expect(JSON.stringify(inProgress)).not.toContain('correctOptionId');
    expect(JSON.stringify(submitted)).not.toContain('correctOptionId');
    expect(JSON.stringify(expired)).not.toContain('correctOptionId');
  });

  it('preserves id/simulatorId/status/deadlineAt(ISO)/score/passed and each question id/prompt/options in order', () => {
    const view = toAttemptView(makeAttempt());

    expect(view.id).toBe('attempt-1');
    expect(view.simulatorId).toBe('sim-1');
    expect(view.status).toBe('in_progress');
    expect(view.deadlineAt).toBe('2025-06-01T10:30:00.000Z');
    expect(view.score).toBeNull();
    expect(view.passed).toBeNull();
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

  it('preserves score/passed once the attempt is finished', () => {
    const view = toAttemptView(
      makeAttempt({ status: 'submitted', score: 75, passed: true }),
    );

    expect(view.score).toBe(75);
    expect(view.passed).toBe(true);
  });

  it('maps an attempt with a single frozen question correctly (non-trivial, non-empty)', () => {
    const view = toAttemptView(
      makeAttempt({
        frozenQuestions: [
          {
            id: 'only-q',
            prompt: 'Only question?',
            options: [{ id: 'a', label: 'A' }],
            correctOptionId: 'a',
          },
        ],
      }),
    );

    expect(view.questions).toHaveLength(1);
    expect(view.questions[0]).toEqual({
      id: 'only-q',
      prompt: 'Only question?',
      options: [{ id: 'a', label: 'A' }],
    });
  });
});
