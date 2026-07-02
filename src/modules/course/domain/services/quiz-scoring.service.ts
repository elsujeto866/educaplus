/**
 * quiz-scoring.service — pure scoring policy for a final-quiz assessment.
 *
 * Stateless functions, zero infrastructure/persistence concerns — this is
 * what keeps AssessmentAttempt a plain data holder (mirroring Assessment)
 * instead of an anemic-vs-rich-model tug-of-war. Both functions are
 * trivially unit-testable at every boundary (all-correct, partial, zero,
 * rounding, empty-quiz, unknown ids).
 *
 * Pure TS — zero infrastructure imports.
 */

import type { Assessment } from '../assessment.entity';
import type { SubmittedAnswer } from '../assessment-attempt.entity';
import { EmptyQuizError, InvalidAttemptError } from '../errors';

export interface ScoringResult {
  score: number;
  passed: boolean;
}

/**
 * Validates that the submitted answers form a strict BIJECTION with the
 * assessment's questions:
 *   - every questionId/selectedOptionId must belong to the assessment
 *   - no questionId may be answered more than once (blocks the
 *     certificate-forgery exploit: repeating one known-correct answer to
 *     inflate `correct` without knowing the other answers)
 *   - every question must be answered exactly once — no missing, no extra
 *
 * This guarantees `correct` (computed in score()) counts at most one match
 * per question, so `correct <= total` always holds and the score can never
 * be gamed by duplication. Throws before any scoring/persistence happens.
 */
export function assertAnswersValid(assessment: Assessment, answers: SubmittedAnswer[]): void {
  const questionsById = new Map(assessment.questions.map((q) => [q.id, q]));
  const seenQuestionIds = new Set<string>();

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new InvalidAttemptError(
        `questionId "${answer.questionId}" does not belong to assessment "${assessment.id}"`,
      );
    }
    if (seenQuestionIds.has(answer.questionId)) {
      throw new InvalidAttemptError(
        `questionId "${answer.questionId}" was answered more than once`,
      );
    }
    seenQuestionIds.add(answer.questionId);

    const validOptionIds = new Set(question.options.map((o) => o.id));
    if (!validOptionIds.has(answer.selectedOptionId)) {
      throw new InvalidAttemptError(
        `selectedOptionId "${answer.selectedOptionId}" is not a valid option for question "${answer.questionId}"`,
      );
    }
  }

  if (seenQuestionIds.size !== questionsById.size) {
    throw new InvalidAttemptError(
      `expected exactly one answer per question: assessment "${assessment.id}" has ${questionsById.size} question(s), received ${seenQuestionIds.size} distinct answer(s)`,
    );
  }
}

/**
 * Computes the percentage score and pass/fail outcome for a submission.
 *
 * score = round(correctCount / totalQuestions * 100); passed = score >= passingScore
 * (>=, not > — a score exactly at the threshold passes).
 *
 * Throws EmptyQuizError when the assessment has zero questions — an empty
 * quiz has no meaningful score and must be rejected before this point is
 * reached in normal flow (the use-case calls this after assertAnswersValid,
 * which is a no-op on an empty answers array against zero questions).
 *
 * PRECONDITION: callers MUST run assertAnswersValid() first. It enforces a
 * strict bijection (exactly one answer per question, no duplicates), which
 * is what guarantees `correct <= total` here — without that guard, a
 * repeated correct answer could inflate `correct` past a fair count.
 */
export function score(assessment: Assessment, answers: SubmittedAnswer[]): ScoringResult {
  const total = assessment.questions.length;
  if (total === 0) {
    throw new EmptyQuizError(assessment.id);
  }

  const correctOptionByQuestionId = new Map(
    assessment.questions.map((q) => [q.id, q.correctOptionId]),
  );

  const correct = answers.filter(
    (answer) => correctOptionByQuestionId.get(answer.questionId) === answer.selectedOptionId,
  ).length;

  const computedScore = Math.round((correct / total) * 100);
  return {
    score: computedScore,
    passed: computedScore >= assessment.passingScore,
  };
}
