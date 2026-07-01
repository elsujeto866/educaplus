/**
 * QuizQuestion value object — polymorphic question payload for a final quiz.
 *
 * Discriminated union on `type`, mirroring the LessonContent pattern:
 *   'single' → MCQ single-correct (implemented)
 *   // 'multi' | 'boolean' — additive future variants, no schema change required
 *     (DB column is schemaless JSONB — see assessments.questions).
 *
 * QuizQuestionFactory.create() is the only construction path — it enforces
 * every invariant so that any QuizQuestion in memory is already valid.
 *
 * Pure TS — zero imports except the domain error type.
 */

import { InvalidQuizQuestionError } from '../errors';

// ---------------------------------------------------------------------------
// Option
// ---------------------------------------------------------------------------

export interface QuizOption {
  readonly id: string;
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Question variants
// ---------------------------------------------------------------------------

export interface SingleChoiceQuestion {
  readonly type: 'single';
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly QuizOption[];
  /** Must reference an existing option id. */
  readonly correctOptionId: string;
}

// | MultiChoiceQuestion | BooleanQuestion — additive, not implemented yet.
export type QuizQuestion = SingleChoiceQuestion;

// ---------------------------------------------------------------------------
// Raw input shape (pre-validation)
// ---------------------------------------------------------------------------

export interface RawQuizOption {
  id: string;
  label: string;
}

export interface RawQuizQuestion {
  type: string;
  id: string;
  prompt: string;
  options: RawQuizOption[];
  correctOptionId: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const QuizQuestionFactory = {
  create(raw: RawQuizQuestion): QuizQuestion {
    if (raw.type !== 'single') {
      throw new InvalidQuizQuestionError(`unsupported question type "${raw.type}"`);
    }
    if (!raw.prompt || !raw.prompt.trim()) {
      throw new InvalidQuizQuestionError('prompt is required');
    }
    if (!raw.options || raw.options.length < 2) {
      throw new InvalidQuizQuestionError('at least 2 options are required');
    }
    for (const option of raw.options) {
      if (!option.label || !option.label.trim()) {
        throw new InvalidQuizQuestionError(`option "${option.id}" has an empty label`);
      }
    }
    const optionIds = raw.options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new InvalidQuizQuestionError('option ids must be unique');
    }
    if (!optionIds.includes(raw.correctOptionId)) {
      throw new InvalidQuizQuestionError(
        `correctOptionId "${raw.correctOptionId}" does not match any option`,
      );
    }

    return {
      type: 'single',
      id: raw.id,
      prompt: raw.prompt,
      options: raw.options.map((o) => ({ id: o.id, label: o.label })),
      correctOptionId: raw.correctOptionId,
    };
  },
};
