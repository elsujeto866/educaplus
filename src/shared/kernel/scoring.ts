/**
 * scoring — pure, module-agnostic quiz scoring policy.
 *
 * Generalized from `modules/course/domain/services/quiz-scoring.service.ts`
 * so it can be reused by `modules/simulator` without a cross-module domain
 * import (a `domain` file may only import `shared-kernel`, per the boundary
 * rules in eslint.config.mjs). `ScorableQuiz` is a structural shape — any
 * entity that exposes { questions, passingScore } in this shape can be
 * scored without this file knowing which module it came from.
 *
 * Stateless functions, zero infrastructure/persistence concerns. Both
 * functions are trivially unit-testable at every boundary (all-correct,
 * partial, zero, rounding, empty-quiz, unknown ids).
 *
 * Pure TS — zero imports from the element graph (domain/application/
 * infrastructure). Errors are kernel-defined so this file has zero deps.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EmptyQuizError extends Error {
  constructor(quizId: string) {
    super(`Quiz "${quizId}" has zero questions — cannot be scored`);
    this.name = 'EmptyQuizError';
  }
}

export class InvalidAnswersError extends Error {
  constructor(reason: string) {
    super(`Invalid answers: ${reason}`);
    this.name = 'InvalidAnswersError';
  }
}

// ---------------------------------------------------------------------------
// Structural shapes
// ---------------------------------------------------------------------------

export interface ScorableOption {
  readonly id: string;
}

export interface ScorableQuestion {
  readonly id: string;
  readonly options: ScorableOption[];
  readonly correctOptionId: string;
}

/**
 * Structural shape any module's quiz/exam-like entity can satisfy to reuse
 * this scoring policy. `id` is optional and used only for error messages —
 * pass the quiz/assessment/simulator id when available.
 */
export interface ScorableQuiz {
  readonly id?: string;
  readonly questions: ScorableQuestion[];
  readonly passingScore: number;
}

export interface SubmittedAnswer {
  readonly questionId: string;
  readonly selectedOptionId: string;
}

export interface ScoringResult {
  score: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// assertAnswersValid
// ---------------------------------------------------------------------------

/**
 * Validates that the submitted answers form a strict BIJECTION with the
 * quiz's questions:
 *   - every questionId/selectedOptionId must belong to the quiz
 *   - no questionId may be answered more than once (blocks the
 *     certificate-forgery exploit: repeating one known-correct answer to
 *     inflate `correct` without knowing the other answers)
 *   - every question must be answered exactly once — no missing, no extra
 *
 * This guarantees `correct` (computed in score()) counts at most one match
 * per question, so `correct <= total` always holds and the score can never
 * be gamed by duplication. Throws before any scoring/persistence happens.
 */
export function assertAnswersValid(quiz: ScorableQuiz, answers: SubmittedAnswer[]): void {
  const questionsById = new Map(quiz.questions.map((q) => [q.id, q]));
  const seenQuestionIds = new Set<string>();

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new InvalidAnswersError(
        `questionId "${answer.questionId}" does not belong to quiz "${quiz.id ?? 'unknown'}"`,
      );
    }
    if (seenQuestionIds.has(answer.questionId)) {
      throw new InvalidAnswersError(
        `questionId "${answer.questionId}" was answered more than once`,
      );
    }
    seenQuestionIds.add(answer.questionId);

    const validOptionIds = new Set(question.options.map((o) => o.id));
    if (!validOptionIds.has(answer.selectedOptionId)) {
      throw new InvalidAnswersError(
        `selectedOptionId "${answer.selectedOptionId}" is not a valid option for question "${answer.questionId}"`,
      );
    }
  }

  if (seenQuestionIds.size !== questionsById.size) {
    throw new InvalidAnswersError(
      `expected exactly one answer per question: quiz "${quiz.id ?? 'unknown'}" has ${questionsById.size} question(s), received ${seenQuestionIds.size} distinct answer(s)`,
    );
  }
}

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

/**
 * Computes the percentage score and pass/fail outcome for a submission.
 *
 * score = round(correctCount / totalQuestions * 100); passed = score >= passingScore
 * (>=, not > — a score exactly at the threshold passes).
 *
 * Throws EmptyQuizError when the quiz has zero questions — an empty quiz has
 * no meaningful score and must be rejected before this point is reached in
 * normal flow (callers run assertAnswersValid() first, which is a no-op on
 * an empty answers array against zero questions).
 *
 * PRECONDITION: callers MUST run assertAnswersValid() first. It enforces a
 * strict bijection (exactly one answer per question, no duplicates), which
 * is what guarantees `correct <= total` here — without that guard, a
 * repeated correct answer could inflate `correct` past a fair count.
 */
export function score(quiz: ScorableQuiz, answers: SubmittedAnswer[]): ScoringResult {
  const total = quiz.questions.length;
  if (total === 0) {
    throw new EmptyQuizError(quiz.id ?? 'unknown');
  }

  const correctOptionByQuestionId = new Map(
    quiz.questions.map((q) => [q.id, q.correctOptionId]),
  );

  const correct = answers.filter(
    (answer) => correctOptionByQuestionId.get(answer.questionId) === answer.selectedOptionId,
  ).length;

  const computedScore = Math.round((correct / total) * 100);
  return {
    score: computedScore,
    passed: computedScore >= quiz.passingScore,
  };
}
