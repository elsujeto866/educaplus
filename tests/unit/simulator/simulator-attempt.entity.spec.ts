/**
 * SimulatorAttempt entity unit tests — Slice S4 (Attempt-Taking).
 *
 * Mirrors `simulator.entity.spec.ts`'s style: eager constructor validation,
 * pure TS, no infrastructure. Covers Decision 1 (simulator_attempts table)
 * invariants plus the immutable submit()/expire() transitions (mirrors
 * `Simulator.publish()/unpublish()`).
 */

import { describe, it, expect } from 'vitest';
import {
  SimulatorAttempt,
  type SimulatorAttemptProps,
  type FrozenQuestion,
} from '../../../src/modules/simulator/domain/simulator-attempt.entity';
import { InvalidSimulatorAttemptError } from '../../../src/modules/simulator/domain/errors';

const startedAt = new Date('2025-01-01T10:00:00Z');
const deadlineAt = new Date('2025-01-01T10:30:00Z');

const frozenQuestions: FrozenQuestion[] = [
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
];

function baseProps(overrides: Partial<SimulatorAttemptProps> = {}): SimulatorAttemptProps {
  return {
    id: 'attempt-1',
    simulatorId: 'sim-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    status: 'in_progress',
    frozenQuestions,
    answers: null,
    score: null,
    passed: null,
    startedAt,
    deadlineAt,
    submittedAt: null,
    createdAt: startedAt,
    ...overrides,
  };
}

describe('SimulatorAttempt entity', () => {
  it('constructs with valid in_progress props', () => {
    const attempt = new SimulatorAttempt(baseProps());

    expect(attempt.id).toBe('attempt-1');
    expect(attempt.simulatorId).toBe('sim-1');
    expect(attempt.academyId).toBe('org_A');
    expect(attempt.clerkUserId).toBe('user_1');
    expect(attempt.status).toBe('in_progress');
    expect(attempt.frozenQuestions).toEqual(frozenQuestions);
    expect(attempt.answers).toBeNull();
    expect(attempt.score).toBeNull();
    expect(attempt.passed).toBeNull();
    expect(attempt.startedAt).toEqual(startedAt);
    expect(attempt.deadlineAt).toEqual(deadlineAt);
    expect(attempt.submittedAt).toBeNull();
  });

  it('throws when id is missing', () => {
    expect(() => new SimulatorAttempt(baseProps({ id: '' }))).toThrow(
      'SimulatorAttempt: id is required',
    );
  });

  it('throws when simulatorId is missing', () => {
    expect(() => new SimulatorAttempt(baseProps({ simulatorId: '' }))).toThrow(
      'SimulatorAttempt: simulatorId is required',
    );
  });

  it('throws when academyId is missing', () => {
    expect(() => new SimulatorAttempt(baseProps({ academyId: '' }))).toThrow(
      'SimulatorAttempt: academyId is required',
    );
  });

  it('throws when clerkUserId is missing', () => {
    expect(() => new SimulatorAttempt(baseProps({ clerkUserId: '' }))).toThrow(
      'SimulatorAttempt: clerkUserId is required',
    );
  });

  it('throws InvalidSimulatorAttemptError when frozenQuestions is empty', () => {
    expect(() => new SimulatorAttempt(baseProps({ frozenQuestions: [] }))).toThrow(
      InvalidSimulatorAttemptError,
    );
  });

  it('throws InvalidSimulatorAttemptError when deadlineAt is not after startedAt', () => {
    expect(() =>
      new SimulatorAttempt(
        baseProps({ startedAt, deadlineAt: new Date(startedAt.getTime() - 1) }),
      ),
    ).toThrow(InvalidSimulatorAttemptError);
  });

  it('throws InvalidSimulatorAttemptError for an unsupported status', () => {
    expect(() =>
      new SimulatorAttempt(baseProps({ status: 'bogus' as unknown as 'in_progress' })),
    ).toThrow(InvalidSimulatorAttemptError);
  });

  it('throws InvalidSimulatorAttemptError when an in_progress attempt has a non-null score', () => {
    expect(() =>
      new SimulatorAttempt(baseProps({ status: 'in_progress', score: 50 })),
    ).toThrow(InvalidSimulatorAttemptError);
  });

  it('throws InvalidSimulatorAttemptError when a submitted attempt has a null score', () => {
    expect(() =>
      new SimulatorAttempt(
        baseProps({ status: 'submitted', score: null, passed: null, submittedAt: new Date() }),
      ),
    ).toThrow(InvalidSimulatorAttemptError);
  });

  it.each([-1, 101, 50.5])(
    'throws InvalidSimulatorAttemptError when a finished attempt has score %s',
    (score) => {
      expect(() =>
        new SimulatorAttempt(
          baseProps({ status: 'submitted', score, passed: true, submittedAt: new Date() }),
        ),
      ).toThrow(InvalidSimulatorAttemptError);
    },
  );

  it('throws InvalidSimulatorAttemptError when a finished attempt has no submittedAt', () => {
    expect(() =>
      new SimulatorAttempt(
        baseProps({ status: 'submitted', score: 50, passed: false, submittedAt: null }),
      ),
    ).toThrow(InvalidSimulatorAttemptError);
  });

  describe('isInProgress', () => {
    it('is true only when status is in_progress', () => {
      expect(new SimulatorAttempt(baseProps({ status: 'in_progress' })).isInProgress).toBe(true);
      expect(
        new SimulatorAttempt(
          baseProps({ status: 'submitted', score: 100, passed: true, submittedAt: new Date() }),
        ).isInProgress,
      ).toBe(false);
    });
  });

  describe('submit()', () => {
    it('returns a new instance transitioned to submitted with score/passed/answers/submittedAt set', () => {
      const attempt = new SimulatorAttempt(baseProps());
      const at = new Date('2025-01-01T10:15:00Z');
      const answers = [{ questionId: 'q-1', selectedOptionId: 'opt-2' }];

      const submitted = attempt.submit({ answers, score: 50, passed: false, at });

      expect(submitted).not.toBe(attempt);
      expect(submitted.status).toBe('submitted');
      expect(submitted.answers).toEqual(answers);
      expect(submitted.score).toBe(50);
      expect(submitted.passed).toBe(false);
      expect(submitted.submittedAt).toEqual(at);
      // Original attempt is untouched — immutability.
      expect(attempt.status).toBe('in_progress');
      expect(attempt.score).toBeNull();
    });
  });

  describe('expire()', () => {
    it('returns a new instance transitioned to expired with score/passed/answers/submittedAt set', () => {
      const attempt = new SimulatorAttempt(baseProps());
      const at = new Date('2025-01-01T10:35:00Z');

      const expired = attempt.expire({ answers: [], score: 0, passed: false, at });

      expect(expired).not.toBe(attempt);
      expect(expired.status).toBe('expired');
      expect(expired.answers).toEqual([]);
      expect(expired.score).toBe(0);
      expect(expired.passed).toBe(false);
      expect(expired.submittedAt).toEqual(at);
      expect(attempt.status).toBe('in_progress');
    });
  });
});
