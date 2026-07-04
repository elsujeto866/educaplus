import { describe, it, expect } from 'vitest';
import { Question } from '../../../src/modules/simulator/domain/question.entity';
import type { QuestionOption } from '../../../src/modules/simulator/domain/question.entity';
import { InvalidQuestionError } from '../../../src/modules/simulator/domain/errors';

const now = new Date('2025-01-01T00:00:00Z');

function makeOptions(): QuestionOption[] {
  return [
    { id: 'opt-1', label: '3' },
    { id: 'opt-2', label: '4' },
  ];
}

function makeProps(
  overrides: Partial<ConstructorParameters<typeof Question>[0]> = {},
): ConstructorParameters<typeof Question>[0] {
  return {
    id: 'question-1',
    bankId: 'bank-1',
    academyId: 'org_A',
    prompt: 'What is 2 + 2?',
    options: makeOptions(),
    correctOptionId: 'opt-2',
    topic: 'arithmetic',
    difficulty: 'easy',
    explanation: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Question', () => {
  it('can be instantiated with valid props', () => {
    const question = new Question(makeProps());
    expect(question.id).toBe('question-1');
    expect(question.bankId).toBe('bank-1');
    expect(question.academyId).toBe('org_A');
    expect(question.prompt).toBe('What is 2 + 2?');
    expect(question.options).toEqual(makeOptions());
    expect(question.correctOptionId).toBe('opt-2');
    expect(question.topic).toBe('arithmetic');
    expect(question.difficulty).toBe('easy');
    expect(question.explanation).toBeNull();
    expect(question.position).toBe(0);
  });

  it('throws when id is missing', () => {
    expect(() => new Question(makeProps({ id: '' }))).toThrow(/id is required/);
  });

  it('throws when bankId is missing', () => {
    expect(() => new Question(makeProps({ bankId: '' }))).toThrow(/bankId is required/);
  });

  it('throws when academyId is missing', () => {
    expect(() => new Question(makeProps({ academyId: '' }))).toThrow(/academyId is required/);
  });

  it('throws InvalidQuestionError when prompt is empty', () => {
    expect(() => new Question(makeProps({ prompt: '' }))).toThrow(InvalidQuestionError);
  });

  it('throws InvalidQuestionError when prompt is whitespace-only', () => {
    expect(() => new Question(makeProps({ prompt: '   ' }))).toThrow(InvalidQuestionError);
  });

  it('throws InvalidQuestionError when there are fewer than 2 options', () => {
    expect(() =>
      new Question(makeProps({ options: [{ id: 'opt-1', label: 'Only one' }], correctOptionId: 'opt-1' })),
    ).toThrow(InvalidQuestionError);
  });

  it('throws InvalidQuestionError when an option label is empty', () => {
    expect(() =>
      new Question(
        makeProps({
          options: [
            { id: 'opt-1', label: '' },
            { id: 'opt-2', label: '4' },
          ],
        }),
      ),
    ).toThrow(InvalidQuestionError);
  });

  it('throws InvalidQuestionError when option ids are duplicated', () => {
    expect(() =>
      new Question(
        makeProps({
          options: [
            { id: 'opt-1', label: '3' },
            { id: 'opt-1', label: '4' },
          ],
          correctOptionId: 'opt-1',
        }),
      ),
    ).toThrow(InvalidQuestionError);
  });

  it('throws InvalidQuestionError when correctOptionId is missing (empty string)', () => {
    expect(() => new Question(makeProps({ correctOptionId: '' }))).toThrow(InvalidQuestionError);
  });

  it('throws InvalidQuestionError when correctOptionId does not match any option', () => {
    expect(() => new Question(makeProps({ correctOptionId: 'opt-missing' }))).toThrow(
      InvalidQuestionError,
    );
  });

  it('throws for an invalid difficulty value', () => {
    expect(() =>
      new Question(makeProps({ difficulty: 'extreme' as unknown as 'easy' })),
    ).toThrow(/Invalid difficulty/);
  });

  it('accepts a null difficulty (unclassified question)', () => {
    const question = new Question(makeProps({ difficulty: null }));
    expect(question.difficulty).toBeNull();
  });

  it('accepts a null topic', () => {
    const question = new Question(makeProps({ topic: null }));
    expect(question.topic).toBeNull();
  });

  it.each([-1, 1.5, NaN])('throws InvalidQuestionError for an invalid position (%s)', (position) => {
    expect(() => new Question(makeProps({ position }))).toThrow(InvalidQuestionError);
  });

  it('defaults topic/difficulty/explanation to null when omitted', () => {
    const question = new Question({
      id: 'question-1',
      bankId: 'bank-1',
      academyId: 'org_A',
      prompt: 'What is 2 + 2?',
      options: makeOptions(),
      correctOptionId: 'opt-2',
      position: 0,
      createdAt: now,
      updatedAt: now,
    });
    expect(question.topic).toBeNull();
    expect(question.difficulty).toBeNull();
    expect(question.explanation).toBeNull();
  });
});
