import { describe, it, expect } from 'vitest';
import { AssessmentAttempt } from '../../../src/modules/course/domain/assessment-attempt.entity';
import type { SubmittedAnswer } from '../../../src/modules/course/domain/assessment-attempt.entity';
import { InvalidAttemptError } from '../../../src/modules/course/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function makeAnswers(overrides: SubmittedAnswer[] = []): SubmittedAnswer[] {
  return overrides.length > 0
    ? overrides
    : [{ questionId: 'q-1', selectedOptionId: 'opt-2' }];
}

function makeProps(
  overrides: Partial<ConstructorParameters<typeof AssessmentAttempt>[0]> = {},
): ConstructorParameters<typeof AssessmentAttempt>[0] {
  return {
    id: 'attempt-1',
    assessmentId: 'assess-1',
    academyId: 'org_A',
    clerkUserId: 'user_1',
    answers: makeAnswers(),
    score: 100,
    passed: true,
    createdAt: now,
    ...overrides,
  };
}

describe('AssessmentAttempt', () => {
  it('can be instantiated with valid props', () => {
    const attempt = new AssessmentAttempt(makeProps());
    expect(attempt.id).toBe('attempt-1');
    expect(attempt.assessmentId).toBe('assess-1');
    expect(attempt.academyId).toBe('org_A');
    expect(attempt.clerkUserId).toBe('user_1');
    expect(attempt.answers).toEqual([{ questionId: 'q-1', selectedOptionId: 'opt-2' }]);
    expect(attempt.score).toBe(100);
    expect(attempt.passed).toBe(true);
    expect(attempt.createdAt).toBe(now);
  });

  it('throws when id is missing', () => {
    expect(() => new AssessmentAttempt(makeProps({ id: '' }))).toThrow(/id is required/);
  });

  it('throws when assessmentId is missing', () => {
    expect(() => new AssessmentAttempt(makeProps({ assessmentId: '' }))).toThrow(
      /assessmentId is required/,
    );
  });

  it('throws when academyId is missing', () => {
    expect(() => new AssessmentAttempt(makeProps({ academyId: '' }))).toThrow(
      /academyId is required/,
    );
  });

  it('throws when clerkUserId is missing', () => {
    expect(() => new AssessmentAttempt(makeProps({ clerkUserId: '' }))).toThrow(
      /clerkUserId is required/,
    );
  });

  it.each([-1, 101, 1.5, NaN])('rejects a non-integer/out-of-range score (%s)', (score) => {
    expect(() => new AssessmentAttempt(makeProps({ score }))).toThrow(
      /score must be an integer between 0 and 100/,
    );
  });

  it('throws the domain InvalidAttemptError (not a generic Error) for an out-of-range score', () => {
    expect(() => new AssessmentAttempt(makeProps({ score: 101 }))).toThrow(InvalidAttemptError);
  });

  it.each([0, 50, 100])('accepts boundary scores (%s)', (score) => {
    expect(() => new AssessmentAttempt(makeProps({ score, passed: score >= 70 }))).not.toThrow();
  });

  it('accepts a boolean passed flag', () => {
    const attempt = new AssessmentAttempt(makeProps({ passed: false, score: 0 }));
    expect(attempt.passed).toBe(false);
  });

  it('accepts an empty answers array', () => {
    const attempt = new AssessmentAttempt(makeProps({ answers: [] }));
    expect(attempt.answers).toEqual([]);
  });
});
