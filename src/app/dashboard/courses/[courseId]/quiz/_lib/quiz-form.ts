import { z } from 'zod';
import type { AssessmentView } from '@/modules/course/composition';
import { computeReorderedIds, type ReorderDirection } from '../../_lib/reorder';

/**
 * Pure, client-side quiz draft logic (design.md: "Client state" + "Client
 * validation"). Mirrors the domain's `QuizQuestionFactory` invariants for
 * UX only — `QuizQuestionFactory.create` remains the single source of
 * truth on the server.
 *
 * Zero framework imports — unit-testable without React/DOM.
 */

// ---------------------------------------------------------------------------
// Draft types
// ---------------------------------------------------------------------------

export interface QuizOptionDraft {
  id: string;
  label: string;
}

export interface QuizQuestionDraft {
  id: string;
  prompt: string;
  options: QuizOptionDraft[];
  correctOptionId: string;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type QuizFormAction =
  | { type: 'ADD_QUESTION'; questionId: string; optionAId: string; optionBId: string }
  | { type: 'REMOVE_QUESTION'; questionId: string }
  | { type: 'REORDER_QUESTION'; questionId: string; direction: ReorderDirection }
  | { type: 'ADD_OPTION'; questionId: string; optionId: string }
  | { type: 'REMOVE_OPTION'; questionId: string; optionId: string }
  | { type: 'SET_PROMPT'; questionId: string; prompt: string }
  | { type: 'SET_OPTION_LABEL'; questionId: string; optionId: string; label: string }
  | { type: 'SET_CORRECT_OPTION'; questionId: string; optionId: string };

export function createEmptyOption(id: string): QuizOptionDraft {
  return { id, label: '' };
}

export function createEmptyQuestion(
  id: string,
  optionAId: string,
  optionBId: string,
): QuizQuestionDraft {
  return {
    id,
    prompt: '',
    options: [createEmptyOption(optionAId), createEmptyOption(optionBId)],
    correctOptionId: optionAId,
  };
}

/** Minimum options per question — mirrors QuizQuestionFactory's invariant. */
const MIN_OPTIONS = 2;

export function quizReducer(state: QuizQuestionDraft[], action: QuizFormAction): QuizQuestionDraft[] {
  switch (action.type) {
    case 'ADD_QUESTION':
      return [...state, createEmptyQuestion(action.questionId, action.optionAId, action.optionBId)];

    case 'REMOVE_QUESTION':
      return state.filter((question) => question.id !== action.questionId);

    case 'REORDER_QUESTION': {
      const orderedIds = state.map((question) => question.id);
      const reordered = computeReorderedIds(orderedIds, action.questionId, action.direction);
      if (reordered === orderedIds) return state;
      return reordered.map((id) => state.find((question) => question.id === id)!);
    }

    case 'ADD_OPTION':
      return state.map((question) =>
        question.id === action.questionId
          ? { ...question, options: [...question.options, createEmptyOption(action.optionId)] }
          : question,
      );

    case 'REMOVE_OPTION':
      return state.map((question) => {
        if (question.id !== action.questionId) return question;
        if (question.options.length <= MIN_OPTIONS) return question;

        const options = question.options.filter((option) => option.id !== action.optionId);
        const correctOptionId =
          question.correctOptionId === action.optionId
            ? (options[0]?.id ?? '')
            : question.correctOptionId;

        return { ...question, options, correctOptionId };
      });

    case 'SET_PROMPT':
      return state.map((question) =>
        question.id === action.questionId ? { ...question, prompt: action.prompt } : question,
      );

    case 'SET_OPTION_LABEL':
      return state.map((question) =>
        question.id === action.questionId
          ? {
              ...question,
              options: question.options.map((option) =>
                option.id === action.optionId ? { ...option, label: action.label } : option,
              ),
            }
          : question,
      );

    case 'SET_CORRECT_OPTION':
      return state.map((question) =>
        question.id === action.questionId ? { ...question, correctOptionId: action.optionId } : question,
      );

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Validation — mirrors QuizQuestionFactory invariants for UX (spec.md:
// "Client-side validation mirrors domain invariants"). An empty
// `questions[]` is a valid, submittable draft — no ≥1-question gate here.
// ---------------------------------------------------------------------------

export interface QuizValidationError {
  questionId: string;
  message: string;
}

export function validateQuizDraft(questions: QuizQuestionDraft[]): QuizValidationError[] {
  const errors: QuizValidationError[] = [];

  for (const question of questions) {
    if (!question.prompt.trim()) {
      errors.push({ questionId: question.id, message: 'El enunciado es obligatorio.' });
      continue;
    }

    const hasEmptyOption = question.options.some((option) => !option.label.trim());
    if (question.options.length < MIN_OPTIONS || hasEmptyOption) {
      errors.push({
        questionId: question.id,
        message: 'Cada pregunta necesita al menos 2 opciones con texto.',
      });
      continue;
    }

    const hasCorrectOption = question.options.some((option) => option.id === question.correctOptionId);
    if (!hasCorrectOption) {
      errors.push({ questionId: question.id, message: 'Seleccioná la opción correcta.' });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Payload transport — a single hidden JSON field (design.md: "Payload
// transport"). Zod validates shape; the server re-validates truth via
// QuizQuestionFactory.create.
// ---------------------------------------------------------------------------

const quizOptionPayloadSchema = z.object({ id: z.string(), label: z.string() });

const quizQuestionPayloadSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(quizOptionPayloadSchema),
  correctOptionId: z.string(),
});

const quizPayloadSchema = z.array(quizQuestionPayloadSchema);

export interface QuizQuestionPayload {
  type: 'single';
  id: string;
  prompt: string;
  options: QuizOptionDraft[];
  correctOptionId: string;
}

export function serializeQuizPayload(questions: QuizQuestionDraft[]): string {
  return JSON.stringify(questions);
}

export function parseQuizPayload(payload: string): QuizQuestionPayload[] {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    throw new InvalidQuizPayloadError();
  }

  const result = quizPayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidQuizPayloadError();
  }

  return result.data.map((question) => ({ type: 'single' as const, ...question }));
}

/**
 * Thrown when the hidden `payload` field is missing, malformed JSON, or
 * does not match the expected question shape. Name-matched in
 * `_lib/action-result.ts` alongside the domain errors it sits next to.
 */
export class InvalidQuizPayloadError extends Error {
  constructor() {
    super('El cuestionario tiene un formato inválido.');
    this.name = 'InvalidQuizPayloadError';
  }
}

// ---------------------------------------------------------------------------
// Prefill mapping — server-side, from the read use-case's view model.
// ---------------------------------------------------------------------------

export function fromAssessmentView(view: AssessmentView | null): QuizQuestionDraft[] {
  if (!view) return [];

  return view.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    options: question.options.map((option) => ({ id: option.id, label: option.label })),
    correctOptionId: question.correctOptionId,
  }));
}

/** Default passing score for a course with no prior assessment (mirrors the DB default). */
export const DEFAULT_PASSING_SCORE = 70;

/**
 * Prefill helper for the passing-score field — mirrors `fromAssessmentView`.
 * A course with no assessment yet prefills with `DEFAULT_PASSING_SCORE`.
 */
export function passingScoreFromView(view: AssessmentView | null): number {
  return view?.passingScore ?? DEFAULT_PASSING_SCORE;
}

/**
 * Client-side mirror of the domain's passingScore invariant (spec.md:
 * "Client rejects invalid value before submit"). Pure — no framework
 * imports. Returns an error message, or `undefined` when valid.
 */
export function validatePassingScore(value: number): string | undefined {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    return 'El puntaje debe ser un entero entre 0 y 100.';
  }
  return undefined;
}
