import { z } from 'zod';

/**
 * Pure, client-side question draft logic (mirrors
 * `courses/[courseId]/quiz/_lib/quiz-form.ts`'s reducer/validate/serialize
 * split). Scoped to a SINGLE question — unlike the course quiz builder
 * (which upserts an entire question array in one payload), each question
 * here is its own repository row with its own Server Action call
 * (AddQuestionUseCase / UpdateQuestionUseCase — Decision 1: relational, not
 * embedded JSONB).
 *
 * Zero framework imports — unit-testable without React/DOM.
 */

// ---------------------------------------------------------------------------
// Draft types
// ---------------------------------------------------------------------------

export interface QuestionOptionDraft {
  id: string;
  label: string;
}

/** `''` represents "no difficulty selected" — mirrors the nullable schema column. */
export type DifficultyDraft = '' | 'easy' | 'medium' | 'hard';

export interface QuestionDraft {
  prompt: string;
  topic: string;
  difficulty: DifficultyDraft;
  explanation: string;
  options: QuestionOptionDraft[];
  correctOptionId: string;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type QuestionFormAction =
  | { type: 'SET_PROMPT'; prompt: string }
  | { type: 'SET_TOPIC'; topic: string }
  | { type: 'SET_DIFFICULTY'; difficulty: DifficultyDraft }
  | { type: 'SET_EXPLANATION'; explanation: string }
  | { type: 'ADD_OPTION'; optionId: string }
  | { type: 'REMOVE_OPTION'; optionId: string }
  | { type: 'SET_OPTION_LABEL'; optionId: string; label: string }
  | { type: 'SET_CORRECT_OPTION'; optionId: string };

/** Minimum options per question — mirrors the `Question` entity's invariant. */
const MIN_OPTIONS = 2;

export function createEmptyOption(id: string): QuestionOptionDraft {
  return { id, label: '' };
}

export function createEmptyQuestionDraft(optionAId: string, optionBId: string): QuestionDraft {
  return {
    prompt: '',
    topic: '',
    difficulty: '',
    explanation: '',
    options: [createEmptyOption(optionAId), createEmptyOption(optionBId)],
    correctOptionId: optionAId,
  };
}

export function questionFormReducer(state: QuestionDraft, action: QuestionFormAction): QuestionDraft {
  switch (action.type) {
    case 'SET_PROMPT':
      return { ...state, prompt: action.prompt };

    case 'SET_TOPIC':
      return { ...state, topic: action.topic };

    case 'SET_DIFFICULTY':
      return { ...state, difficulty: action.difficulty };

    case 'SET_EXPLANATION':
      return { ...state, explanation: action.explanation };

    case 'ADD_OPTION':
      return { ...state, options: [...state.options, createEmptyOption(action.optionId)] };

    case 'REMOVE_OPTION': {
      if (state.options.length <= MIN_OPTIONS) return state;

      const options = state.options.filter((option) => option.id !== action.optionId);
      const correctOptionId =
        state.correctOptionId === action.optionId ? (options[0]?.id ?? '') : state.correctOptionId;

      return { ...state, options, correctOptionId };
    }

    case 'SET_OPTION_LABEL':
      return {
        ...state,
        options: state.options.map((option) =>
          option.id === action.optionId ? { ...option, label: action.label } : option,
        ),
      };

    case 'SET_CORRECT_OPTION':
      return { ...state, correctOptionId: action.optionId };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Validation — mirrors the `Question` entity invariants for UX.
// ---------------------------------------------------------------------------

export function validateQuestionDraft(draft: QuestionDraft): string | undefined {
  if (!draft.prompt.trim()) {
    return 'El enunciado es obligatorio.';
  }

  const hasEmptyOption = draft.options.some((option) => !option.label.trim());
  if (draft.options.length < MIN_OPTIONS || hasEmptyOption) {
    return 'Cada pregunta necesita al menos 2 opciones con texto.';
  }

  const hasCorrectOption = draft.options.some((option) => option.id === draft.correctOptionId);
  if (!hasCorrectOption) {
    return 'Seleccioná la opción correcta.';
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Payload transport — options + correctOptionId travel as one hidden JSON
// field (mirrors quiz-form.ts's payload field); prompt/topic/difficulty/
// explanation travel as plain named form fields.
// ---------------------------------------------------------------------------

const optionPayloadSchema = z.object({ id: z.string(), label: z.string() });

const optionsPayloadSchema = z.object({
  options: z.array(optionPayloadSchema),
  correctOptionId: z.string(),
});

export interface OptionsPayload {
  options: QuestionOptionDraft[];
  correctOptionId: string;
}

export function serializeOptionsPayload(draft: QuestionDraft): string {
  return JSON.stringify({ options: draft.options, correctOptionId: draft.correctOptionId });
}

export function parseOptionsPayload(payload: string): OptionsPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    throw new InvalidOptionsPayloadError();
  }

  const result = optionsPayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidOptionsPayloadError();
  }

  return result.data;
}

/**
 * Thrown when the hidden options payload is missing, malformed JSON, or
 * does not match the expected shape. Name-matched in `_lib/action-result.ts`
 * alongside the domain errors it sits next to (mirrors
 * `InvalidQuizPayloadError`).
 */
export class InvalidOptionsPayloadError extends Error {
  constructor() {
    super('Las opciones de la pregunta tienen un formato inválido.');
    this.name = 'InvalidOptionsPayloadError';
  }
}
