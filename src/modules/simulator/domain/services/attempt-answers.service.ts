import type { FrozenQuestion, SubmittedAnswer } from '../simulator-attempt.entity';
import { InvalidAttemptAnswersError } from '../errors';

/**
 * assertPartialAnswersValid — SubmitAttemptUseCase's answer-validation gate.
 *
 * Deliberately NOT a full bijection like `shared/kernel/scoring`'s
 * `assertAnswersValid`: a simulator attempt may legitimately be submitted
 * with FEWER answers than questions (Decision 5 — "auto-scores what
 * exists"; an unanswered question just counts as wrong). It still enforces
 * the two invariants that prevent gaming the score:
 *
 *   - every questionId must belong to THIS attempt's frozen snapshot
 *     (blocks injecting an answer for a question that was never selected)
 *   - no questionId may be answered more than once (blocks the same
 *     duplicate-answer scoring exploit `assertAnswersValid` guards
 *     against — `shared/kernel/scoring.score()` counts every matching
 *     answer, so a repeated correct answer would otherwise inflate
 *     `correct` past a fair count)
 *   - every selectedOptionId must be a real option of its question
 *
 * Pure — zero infra imports.
 */
export function assertPartialAnswersValid(
  frozenQuestions: readonly FrozenQuestion[],
  answers: readonly SubmittedAnswer[],
): void {
  const questionsById = new Map(frozenQuestions.map((q) => [q.id, q]));
  const seenQuestionIds = new Set<string>();

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (!question) {
      throw new InvalidAttemptAnswersError(
        `questionId "${answer.questionId}" does not belong to this attempt`,
      );
    }
    if (seenQuestionIds.has(answer.questionId)) {
      throw new InvalidAttemptAnswersError(
        `questionId "${answer.questionId}" was answered more than once`,
      );
    }
    seenQuestionIds.add(answer.questionId);

    const validOptionIds = new Set(question.options.map((o) => o.id));
    if (!validOptionIds.has(answer.selectedOptionId)) {
      throw new InvalidAttemptAnswersError(
        `selectedOptionId "${answer.selectedOptionId}" is not a valid option for question "${answer.questionId}"`,
      );
    }
  }
}
