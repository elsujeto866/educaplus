/**
 * quiz-form.ts unit tests — pure client-side quiz draft logic.
 * Covers spec.md's add/remove/reorder question+option, exclusive
 * radio-correct semantics, client validation mirroring the domain
 * invariants (empty questions[] stays a valid draft), and the payload
 * parse/serialize round-trip.
 */

import { describe, it, expect } from 'vitest';
import {
  quizReducer,
  validateQuizDraft,
  parseQuizPayload,
  serializeQuizPayload,
  createEmptyQuestion,
  createEmptyOption,
  fromAssessmentView,
  type QuizQuestionDraft,
} from '../../../src/app/dashboard/courses/[courseId]/quiz/_lib/quiz-form';
import type { AssessmentView } from '../../../src/modules/course/composition';

function makeQuestion(overrides: Partial<QuizQuestionDraft> = {}): QuizQuestionDraft {
  return {
    id: 'q-1',
    prompt: '2 + 2?',
    options: [
      { id: 'opt-1', label: '3' },
      { id: 'opt-2', label: '4' },
    ],
    correctOptionId: 'opt-2',
    ...overrides,
  };
}

describe('createEmptyQuestion / createEmptyOption', () => {
  it('creates an option with the given id and empty label', () => {
    expect(createEmptyOption('opt-x')).toEqual({ id: 'opt-x', label: '' });
  });

  it('creates a question with 2 empty options and the first marked correct', () => {
    const question = createEmptyQuestion('q-x', 'opt-a', 'opt-b');
    expect(question).toEqual({
      id: 'q-x',
      prompt: '',
      options: [
        { id: 'opt-a', label: '' },
        { id: 'opt-b', label: '' },
      ],
      correctOptionId: 'opt-a',
    });
  });
});

describe('quizReducer', () => {
  it('ADD_QUESTION appends a new empty question', () => {
    const result = quizReducer([], {
      type: 'ADD_QUESTION',
      questionId: 'q-1',
      optionAId: 'opt-1',
      optionBId: 'opt-2',
    });
    expect(result).toEqual([createEmptyQuestion('q-1', 'opt-1', 'opt-2')]);
  });

  it('REMOVE_QUESTION removes the targeted question', () => {
    const state = [makeQuestion({ id: 'q-1' }), makeQuestion({ id: 'q-2' })];
    const result = quizReducer(state, { type: 'REMOVE_QUESTION', questionId: 'q-1' });
    expect(result.map((q) => q.id)).toEqual(['q-2']);
  });

  it('REORDER_QUESTION moves a question up, swapping with its neighbor', () => {
    const state = [makeQuestion({ id: 'a' }), makeQuestion({ id: 'b' }), makeQuestion({ id: 'c' })];
    const result = quizReducer(state, { type: 'REORDER_QUESTION', questionId: 'c', direction: 'up' });
    expect(result.map((q) => q.id)).toEqual(['a', 'c', 'b']);
  });

  it('REORDER_QUESTION is a no-op when moving the first question up', () => {
    const state = [makeQuestion({ id: 'a' }), makeQuestion({ id: 'b' })];
    const result = quizReducer(state, { type: 'REORDER_QUESTION', questionId: 'a', direction: 'up' });
    expect(result.map((q) => q.id)).toEqual(['a', 'b']);
  });

  it('ADD_OPTION appends a new empty option to the targeted question', () => {
    const state = [makeQuestion({ id: 'q-1' })];
    const result = quizReducer(state, { type: 'ADD_OPTION', questionId: 'q-1', optionId: 'opt-3' });
    expect(result[0]?.options.map((o) => o.id)).toEqual(['opt-1', 'opt-2', 'opt-3']);
  });

  it('REMOVE_OPTION removes an option when there are more than 2', () => {
    const state = [
      makeQuestion({
        id: 'q-1',
        options: [
          { id: 'opt-1', label: '3' },
          { id: 'opt-2', label: '4' },
          { id: 'opt-3', label: '5' },
        ],
      }),
    ];
    const result = quizReducer(state, { type: 'REMOVE_OPTION', questionId: 'q-1', optionId: 'opt-3' });
    expect(result[0]?.options.map((o) => o.id)).toEqual(['opt-1', 'opt-2']);
  });

  it('REMOVE_OPTION is blocked when the question already has only 2 options', () => {
    const state = [makeQuestion({ id: 'q-1' })];
    const result = quizReducer(state, { type: 'REMOVE_OPTION', questionId: 'q-1', optionId: 'opt-1' });
    expect(result[0]?.options).toHaveLength(2);
  });

  it('REMOVE_OPTION reassigns correctOptionId when the correct option is removed', () => {
    const state = [
      makeQuestion({
        id: 'q-1',
        options: [
          { id: 'opt-1', label: '3' },
          { id: 'opt-2', label: '4' },
          { id: 'opt-3', label: '5' },
        ],
        correctOptionId: 'opt-3',
      }),
    ];
    const result = quizReducer(state, { type: 'REMOVE_OPTION', questionId: 'q-1', optionId: 'opt-3' });
    expect(result[0]?.correctOptionId).toBe('opt-1');
  });

  it('SET_PROMPT edits the question prompt', () => {
    const state = [makeQuestion({ id: 'q-1', prompt: 'old' })];
    const result = quizReducer(state, { type: 'SET_PROMPT', questionId: 'q-1', prompt: 'new' });
    expect(result[0]?.prompt).toBe('new');
  });

  it('SET_OPTION_LABEL edits a single option label', () => {
    const state = [makeQuestion({ id: 'q-1' })];
    const result = quizReducer(state, {
      type: 'SET_OPTION_LABEL',
      questionId: 'q-1',
      optionId: 'opt-1',
      label: 'Five',
    });
    expect(result[0]?.options.find((o) => o.id === 'opt-1')?.label).toBe('Five');
  });

  it('SET_CORRECT_OPTION marks the new option correct, unselecting the previous one (exclusive)', () => {
    const state = [makeQuestion({ id: 'q-1', correctOptionId: 'opt-2' })];
    const result = quizReducer(state, { type: 'SET_CORRECT_OPTION', questionId: 'q-1', optionId: 'opt-1' });
    expect(result[0]?.correctOptionId).toBe('opt-1');
  });
});

describe('validateQuizDraft', () => {
  it('accepts an empty questions[] as a valid draft', () => {
    expect(validateQuizDraft([])).toEqual([]);
  });

  it('accepts a fully well-formed question', () => {
    expect(validateQuizDraft([makeQuestion()])).toEqual([]);
  });

  it('flags an empty prompt', () => {
    const errors = validateQuizDraft([makeQuestion({ prompt: '  ' })]);
    expect(errors).toEqual([{ questionId: 'q-1', message: expect.any(String) }]);
  });

  it('flags fewer than 2 non-empty options', () => {
    const errors = validateQuizDraft([
      makeQuestion({
        options: [
          { id: 'opt-1', label: '3' },
          { id: 'opt-2', label: '' },
        ],
      }),
    ]);
    expect(errors).toEqual([{ questionId: 'q-1', message: expect.any(String) }]);
  });

  it('flags a missing correct-option selection', () => {
    const errors = validateQuizDraft([makeQuestion({ correctOptionId: 'opt-missing' })]);
    expect(errors).toEqual([{ questionId: 'q-1', message: expect.any(String) }]);
  });
});

describe('parseQuizPayload / serializeQuizPayload', () => {
  it('round-trips a list of question drafts through JSON', () => {
    const questions = [makeQuestion()];
    const serialized = serializeQuizPayload(questions);
    const parsed = parseQuizPayload(serialized);

    expect(parsed).toEqual([
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
    ]);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseQuizPayload('{not json')).toThrow();
  });

  it('throws when the payload is not an array of well-shaped questions', () => {
    expect(() => parseQuizPayload(JSON.stringify({ oops: true }))).toThrow();
  });
});

describe('fromAssessmentView', () => {
  it('maps an existing assessment view to question drafts', () => {
    const view: AssessmentView = {
      id: 'assess-1',
      courseId: 'course-1',
      title: 'Quiz final',
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
      ],
    };

    expect(fromAssessmentView(view)).toEqual([makeQuestion()]);
  });

  it('returns an empty array when there is no assessment yet', () => {
    expect(fromAssessmentView(null)).toEqual([]);
  });
});
