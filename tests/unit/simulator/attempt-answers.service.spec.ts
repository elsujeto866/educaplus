/**
 * assertPartialAnswersValid unit tests — Slice S4.
 *
 * Pure domain service, no mocks needed. Mirrors
 * `question-selection.service.spec.ts`'s exhaustive-edge-case style.
 */

import { describe, it, expect } from 'vitest';
import { assertPartialAnswersValid } from '../../../src/modules/simulator/domain/services/attempt-answers.service';
import { InvalidAttemptAnswersError } from '../../../src/modules/simulator/domain/errors';
import type { FrozenQuestion } from '../../../src/modules/simulator/domain/simulator-attempt.entity';

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

describe('assertPartialAnswersValid', () => {
  it('accepts a full, valid answer set (one per question)', () => {
    expect(() =>
      assertPartialAnswersValid(frozenQuestions, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
      ]),
    ).not.toThrow();
  });

  it('accepts a PARTIAL answer set (fewer answers than questions)', () => {
    expect(() =>
      assertPartialAnswersValid(frozenQuestions, [{ questionId: 'q-1', selectedOptionId: 'opt-2' }]),
    ).not.toThrow();
  });

  it('accepts an EMPTY answer set', () => {
    expect(() => assertPartialAnswersValid(frozenQuestions, [])).not.toThrow();
  });

  it('rejects an answer whose questionId is not in the frozen snapshot', () => {
    expect(() =>
      assertPartialAnswersValid(frozenQuestions, [
        { questionId: 'foreign-question', selectedOptionId: 'opt-1' },
      ]),
    ).toThrow(InvalidAttemptAnswersError);
  });

  it('rejects a duplicate answer for the same question (blocks score-inflation by repetition)', () => {
    expect(() =>
      assertPartialAnswersValid(frozenQuestions, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-1', selectedOptionId: 'opt-1' },
      ]),
    ).toThrow(InvalidAttemptAnswersError);
  });

  it('rejects a selectedOptionId that does not belong to its question', () => {
    expect(() =>
      assertPartialAnswersValid(frozenQuestions, [
        { questionId: 'q-1', selectedOptionId: 'opt-4' }, // opt-4 belongs to q-2, not q-1
      ]),
    ).toThrow(InvalidAttemptAnswersError);
  });
});
