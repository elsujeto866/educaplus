import { describe, it, expect } from 'vitest';
import {
  assertAnswersValid,
  score,
  EmptyQuizError,
  InvalidAnswersError,
  type ScorableQuiz,
} from '../../../src/shared/kernel/scoring';

function makeQuiz(overrides: Partial<ScorableQuiz> = {}): ScorableQuiz {
  return {
    passingScore: 70,
    questions: [
      { id: 'q-1', options: [{ id: 'opt-1' }, { id: 'opt-2' }], correctOptionId: 'opt-2' },
      { id: 'q-2', options: [{ id: 'opt-3' }, { id: 'opt-4' }], correctOptionId: 'opt-4' },
      { id: 'q-3', options: [{ id: 'opt-5' }, { id: 'opt-6' }], correctOptionId: 'opt-5' },
    ],
    ...overrides,
  };
}

describe('shared/kernel/scoring — score()', () => {
  it('scores 100 when all answers are correct', () => {
    const quiz = makeQuiz();
    const result = score(quiz, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-4' },
      { questionId: 'q-3', selectedOptionId: 'opt-5' },
    ]);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('scores 0 when all answers are wrong', () => {
    const quiz = makeQuiz();
    const result = score(quiz, [
      { questionId: 'q-1', selectedOptionId: 'opt-1' },
      { questionId: 'q-2', selectedOptionId: 'opt-3' },
      { questionId: 'q-3', selectedOptionId: 'opt-6' },
    ]);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('rounds partial correctness: 2 of 3 correct = round(66.67) = 67', () => {
    const quiz = makeQuiz();
    const result = score(quiz, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-4' },
      { questionId: 'q-3', selectedOptionId: 'opt-6' },
    ]);
    expect(result.score).toBe(67);
    expect(result.passed).toBe(false);
  });

  it('passes when score exactly equals passingScore (>=, not >)', () => {
    const quiz = makeQuiz({
      passingScore: 50,
      questions: [
        { id: 'q-1', options: [{ id: 'opt-1' }, { id: 'opt-2' }], correctOptionId: 'opt-2' },
        { id: 'q-2', options: [{ id: 'opt-3' }, { id: 'opt-4' }], correctOptionId: 'opt-4' },
      ],
    });
    const result = score(quiz, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-3' },
    ]);
    expect(result.score).toBe(50);
    expect(result.passed).toBe(true);
  });

  it('fails when score is just below passingScore', () => {
    const quiz = makeQuiz({ passingScore: 70 });
    const result = score(quiz, [
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-3' },
      { questionId: 'q-3', selectedOptionId: 'opt-6' },
    ]);
    expect(result.score).toBe(33);
    expect(result.passed).toBe(false);
  });

  it('throws EmptyQuizError when the quiz has zero questions', () => {
    const quiz = makeQuiz({ questions: [] });
    expect(() => score(quiz, [])).toThrow(EmptyQuizError);
  });
});

describe('shared/kernel/scoring — assertAnswersValid()', () => {
  it('does not throw for a fully valid set of answers', () => {
    const quiz = makeQuiz();
    expect(() =>
      assertAnswersValid(quiz, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
        { questionId: 'q-3', selectedOptionId: 'opt-5' },
      ]),
    ).not.toThrow();
  });

  it('throws InvalidAnswersError for an unknown questionId', () => {
    const quiz = makeQuiz();
    expect(() =>
      assertAnswersValid(quiz, [{ questionId: 'q-unknown', selectedOptionId: 'opt-2' }]),
    ).toThrow(InvalidAnswersError);
  });

  it('throws InvalidAnswersError for an unknown optionId on a known question', () => {
    const quiz = makeQuiz();
    expect(() =>
      assertAnswersValid(quiz, [{ questionId: 'q-1', selectedOptionId: 'opt-unknown' }]),
    ).toThrow(InvalidAnswersError);
  });

  it('throws InvalidAnswersError when the same questionId is answered more than once', () => {
    const quiz = makeQuiz();
    expect(() =>
      assertAnswersValid(quiz, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-1', selectedOptionId: 'opt-1' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
        { questionId: 'q-3', selectedOptionId: 'opt-5' },
      ]),
    ).toThrow(InvalidAnswersError);
  });

  it('rejects the certificate-forgery exploit: one known-correct answer repeated for every question', () => {
    const quiz = makeQuiz();
    expect(() =>
      assertAnswersValid(quiz, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
      ]),
    ).toThrow(InvalidAnswersError);
  });

  it('throws InvalidAnswersError for partial answers (fewer answers than questions)', () => {
    const quiz = makeQuiz();
    expect(() =>
      assertAnswersValid(quiz, [
        { questionId: 'q-1', selectedOptionId: 'opt-2' },
        { questionId: 'q-2', selectedOptionId: 'opt-4' },
      ]),
    ).toThrow(InvalidAnswersError);
  });

  it('throws InvalidAnswersError for an unanswered quiz (zero answers, non-empty quiz)', () => {
    const quiz = makeQuiz();
    expect(() => assertAnswersValid(quiz, [])).toThrow(InvalidAnswersError);
  });
});
