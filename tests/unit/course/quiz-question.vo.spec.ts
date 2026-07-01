import { describe, it, expect } from 'vitest';
import { QuizQuestionFactory } from '../../../src/modules/course/domain/value-objects/quiz-question.vo';
import { InvalidQuizQuestionError } from '../../../src/modules/course/domain/errors';

function validRaw(overrides: Partial<Parameters<typeof QuizQuestionFactory.create>[0]> = {}) {
  return {
    type: 'single' as const,
    id: 'q-1',
    prompt: 'What is 2 + 2?',
    options: [
      { id: 'opt-1', label: '3' },
      { id: 'opt-2', label: '4' },
    ],
    correctOptionId: 'opt-2',
    ...overrides,
  };
}

describe('QuizQuestionFactory.create', () => {
  it('creates a valid single-choice question', () => {
    const question = QuizQuestionFactory.create(validRaw());
    expect(question.type).toBe('single');
    expect(question.id).toBe('q-1');
    expect(question.prompt).toBe('What is 2 + 2?');
    expect(question.options).toHaveLength(2);
    expect(question.correctOptionId).toBe('opt-2');
  });

  it('preserves the type discriminant on the resulting value object', () => {
    const question = QuizQuestionFactory.create(validRaw());
    expect(question.type).toBe('single');
  });

  it('throws InvalidQuizQuestionError when prompt is empty', () => {
    expect(() => QuizQuestionFactory.create(validRaw({ prompt: '' }))).toThrow(
      InvalidQuizQuestionError,
    );
  });

  it('throws InvalidQuizQuestionError when prompt is whitespace-only', () => {
    expect(() => QuizQuestionFactory.create(validRaw({ prompt: '   ' }))).toThrow(
      InvalidQuizQuestionError,
    );
  });

  it('throws InvalidQuizQuestionError when there are fewer than 2 options', () => {
    expect(() =>
      QuizQuestionFactory.create(
        validRaw({ options: [{ id: 'opt-1', label: 'Only one' }], correctOptionId: 'opt-1' }),
      ),
    ).toThrow(InvalidQuizQuestionError);
  });

  it('throws InvalidQuizQuestionError when an option label is empty', () => {
    expect(() =>
      QuizQuestionFactory.create(
        validRaw({
          options: [
            { id: 'opt-1', label: '' },
            { id: 'opt-2', label: '4' },
          ],
        }),
      ),
    ).toThrow(InvalidQuizQuestionError);
  });

  it('throws InvalidQuizQuestionError when an option label is whitespace-only', () => {
    expect(() =>
      QuizQuestionFactory.create(
        validRaw({
          options: [
            { id: 'opt-1', label: '   ' },
            { id: 'opt-2', label: '4' },
          ],
        }),
      ),
    ).toThrow(InvalidQuizQuestionError);
  });

  it('throws InvalidQuizQuestionError when option ids are duplicated', () => {
    expect(() =>
      QuizQuestionFactory.create(
        validRaw({
          options: [
            { id: 'opt-1', label: '3' },
            { id: 'opt-1', label: '4' },
          ],
          correctOptionId: 'opt-1',
        }),
      ),
    ).toThrow(InvalidQuizQuestionError);
  });

  it('throws InvalidQuizQuestionError when correctOptionId does not match any option', () => {
    expect(() =>
      QuizQuestionFactory.create(validRaw({ correctOptionId: 'opt-missing' })),
    ).toThrow(InvalidQuizQuestionError);
  });

  it('throws InvalidQuizQuestionError for an unsupported question type', () => {
    expect(() =>
      QuizQuestionFactory.create(validRaw({ type: 'multi' as unknown as 'single' })),
    ).toThrow(InvalidQuizQuestionError);
  });
});
