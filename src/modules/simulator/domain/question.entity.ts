import { InvalidQuestionError } from './errors';
import { parseDifficulty, type Difficulty } from './value-objects/difficulty.vo';

/**
 * QuestionOption — one selectable answer for a Question.
 *
 * Deliberately a smaller shape than course's `QuizOption` VO (same `{id,
 * label}` structure though) — this module owns its own relational Question
 * row (see Decision 1: questions are queryable-by-topic/difficulty rows, NOT
 * an embedded JSONB polymorphic question type like course's Assessment).
 */
export interface QuestionOption {
  readonly id: string;
  readonly label: string;
}

export interface QuestionProps {
  id: string;
  bankId: string;
  academyId: string;
  prompt: string;
  options: QuestionOption[];
  /** Must reference an existing option id. */
  correctOptionId: string;
  /** Free-text topic/category tag; used by the simulator's topicFilter. */
  topic?: string | null;
  difficulty?: Difficulty | null;
  explanation?: string | null;
  /** Authoring order within the bank; defaults to 0. */
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Question entity — a single-choice MCQ row inside a QuestionBank.
 *
 * Relational (not embedded JSONB) so it can be queried and randomly
 * selected by topic/difficulty at StartAttempt time (Decision 7). Options
 * and the correct-answer invariant are validated eagerly in the constructor
 * so any Question in memory is already valid — mirrors
 * `QuizQuestionFactory.create()`'s invariants without importing it (that
 * would be a cross-module domain import, disallowed by the boundaries rule).
 *
 * Pure TS — zero infrastructure imports.
 */
export class Question {
  readonly id: string;
  readonly bankId: string;
  readonly academyId: string;
  readonly prompt: string;
  readonly options: QuestionOption[];
  readonly correctOptionId: string;
  readonly topic: string | null;
  readonly difficulty: Difficulty | null;
  readonly explanation: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: QuestionProps) {
    if (!props.id) throw new Error('Question: id is required');
    if (!props.bankId) throw new Error('Question: bankId is required');
    if (!props.academyId) throw new Error('Question: academyId is required');
    if (!props.prompt || !props.prompt.trim()) {
      throw new InvalidQuestionError('prompt is required');
    }
    if (!props.options || props.options.length < 2) {
      throw new InvalidQuestionError('at least 2 options are required');
    }
    for (const option of props.options) {
      if (!option.label || !option.label.trim()) {
        throw new InvalidQuestionError(`option "${option.id}" has an empty label`);
      }
    }
    const optionIds = props.options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new InvalidQuestionError('option ids must be unique');
    }
    if (!props.correctOptionId || !optionIds.includes(props.correctOptionId)) {
      throw new InvalidQuestionError(
        `correctOptionId "${props.correctOptionId}" does not match any option`,
      );
    }
    if (props.difficulty != null) {
      // Throws a plain Error (message: /Invalid difficulty/) on an unknown value —
      // parseDifficulty's own contract, not re-wrapped here.
      parseDifficulty(props.difficulty);
    }
    if (!Number.isInteger(props.position) || props.position < 0) {
      throw new InvalidQuestionError('position must be a non-negative integer');
    }

    this.id = props.id;
    this.bankId = props.bankId;
    this.academyId = props.academyId;
    this.prompt = props.prompt;
    this.options = props.options.map((o) => ({ id: o.id, label: o.label }));
    this.correctOptionId = props.correctOptionId;
    this.topic = props.topic ?? null;
    this.difficulty = props.difficulty ?? null;
    this.explanation = props.explanation ?? null;
    this.position = props.position;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
