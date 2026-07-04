/**
 * Pure client-side question draft logic — reducer, validation, and
 * hidden-field payload serialization for the bank question editor. Zero
 * framework imports — unit-testable without React/DOM. Mirrors
 * `courses/[courseId]/quiz/_lib/quiz-form.ts`'s reducer/validate/serialize
 * split, scoped to a single question instead of an array of questions
 * (each question here is its own repository row — see Decision 1).
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyQuestionDraft,
  questionFormReducer,
  validateQuestionDraft,
  serializeOptionsPayload,
  parseOptionsPayload,
  InvalidOptionsPayloadError,
} from '../../../src/app/dashboard/simulators/banks/[bankId]/_lib/question-form';

describe('createEmptyQuestionDraft', () => {
  it('starts with 2 empty options and the first marked correct', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');

    expect(draft.options).toHaveLength(2);
    expect(draft.correctOptionId).toBe('opt-a');
    expect(draft.prompt).toBe('');
  });
});

describe('questionFormReducer', () => {
  it('ADD_OPTION appends an empty option', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, { type: 'ADD_OPTION', optionId: 'opt-c' });

    expect(next.options).toHaveLength(3);
    expect(next.options[2]).toEqual({ id: 'opt-c', label: '' });
  });

  it('REMOVE_OPTION reassigns correctOptionId when the correct option is removed', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const withThird = questionFormReducer(draft, { type: 'ADD_OPTION', optionId: 'opt-c' });
    const next = questionFormReducer(withThird, { type: 'REMOVE_OPTION', optionId: 'opt-a' });

    expect(next.options).toHaveLength(2);
    expect(next.correctOptionId).toBe('opt-b');
  });

  it('REMOVE_OPTION is a no-op at the 2-option floor', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, { type: 'REMOVE_OPTION', optionId: 'opt-a' });

    expect(next.options).toHaveLength(2);
  });

  it('SET_OPTION_LABEL updates only the targeted option', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, {
      type: 'SET_OPTION_LABEL',
      optionId: 'opt-b',
      label: 'París',
    });

    expect(next.options.find((o) => o.id === 'opt-b')?.label).toBe('París');
    expect(next.options.find((o) => o.id === 'opt-a')?.label).toBe('');
  });

  it('SET_CORRECT_OPTION changes the correct option id', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, { type: 'SET_CORRECT_OPTION', optionId: 'opt-b' });

    expect(next.correctOptionId).toBe('opt-b');
  });

  it('SET_PROMPT updates the prompt', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, { type: 'SET_PROMPT', prompt: '¿Capital de Francia?' });

    expect(next.prompt).toBe('¿Capital de Francia?');
  });

  it('SET_TOPIC updates the topic', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, { type: 'SET_TOPIC', topic: 'geografía' });

    expect(next.topic).toBe('geografía');
  });

  it('SET_DIFFICULTY updates the difficulty', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, { type: 'SET_DIFFICULTY', difficulty: 'hard' });

    expect(next.difficulty).toBe('hard');
  });

  it('SET_EXPLANATION updates the explanation', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const next = questionFormReducer(draft, { type: 'SET_EXPLANATION', explanation: 'Es la capital.' });

    expect(next.explanation).toBe('Es la capital.');
  });
});

describe('validateQuestionDraft', () => {
  it('rejects an empty prompt', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    expect(validateQuestionDraft(draft)).toMatch(/enunciado/i);
  });

  it('rejects when any option label is empty', () => {
    let draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    draft = questionFormReducer(draft, { type: 'SET_PROMPT', prompt: 'Pregunta' });
    draft = questionFormReducer(draft, { type: 'SET_OPTION_LABEL', optionId: 'opt-a', label: 'Madrid' });
    // opt-b label stays empty

    expect(validateQuestionDraft(draft)).toMatch(/opci/i);
  });

  it('returns undefined for a fully valid draft', () => {
    let draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    draft = questionFormReducer(draft, { type: 'SET_PROMPT', prompt: '¿Capital de Francia?' });
    draft = questionFormReducer(draft, { type: 'SET_OPTION_LABEL', optionId: 'opt-a', label: 'Madrid' });
    draft = questionFormReducer(draft, { type: 'SET_OPTION_LABEL', optionId: 'opt-b', label: 'París' });
    draft = questionFormReducer(draft, { type: 'SET_CORRECT_OPTION', optionId: 'opt-b' });

    expect(validateQuestionDraft(draft)).toBeUndefined();
  });
});

describe('serializeOptionsPayload / parseOptionsPayload', () => {
  it('round-trips options + correctOptionId', () => {
    const draft = createEmptyQuestionDraft('opt-a', 'opt-b');
    const filled = questionFormReducer(draft, {
      type: 'SET_OPTION_LABEL',
      optionId: 'opt-a',
      label: 'Madrid',
    });

    const payload = serializeOptionsPayload(filled);
    const parsed = parseOptionsPayload(payload);

    expect(parsed.options).toEqual(filled.options);
    expect(parsed.correctOptionId).toBe(filled.correctOptionId);
  });

  it('throws InvalidOptionsPayloadError on malformed JSON', () => {
    expect(() => parseOptionsPayload('not json')).toThrow(InvalidOptionsPayloadError);
  });

  it('throws InvalidOptionsPayloadError when the shape does not match', () => {
    expect(() => parseOptionsPayload(JSON.stringify({ foo: 'bar' }))).toThrow(
      InvalidOptionsPayloadError,
    );
  });
});
