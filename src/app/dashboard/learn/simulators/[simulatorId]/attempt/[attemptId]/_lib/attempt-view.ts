/**
 * AttemptView — the ONLY attempt shape that may reach the 'use client'
 * exam runner. `SimulatorAttempt.frozenQuestions` (returned by
 * `GetAttemptUseCase`/`StartAttemptUseCase`) carries `correctOptionId` —
 * the server needs it to score the attempt, but the student-facing runner
 * must never see it (design Decision 1's security note / spec.md's
 * correct-answer-strip requirement).
 *
 * `AttemptViewSource` is a LOCAL structural type (never an import from
 * `@/modules/simulator/domain/...`) so this file never crosses the
 * `delivery` → `domain` eslint-boundaries edge — `SimulatorAttempt`
 * satisfies this shape structurally, no explicit import needed. Mirrors
 * `quiz-view.ts`'s "explicit field picking, never spread" guarantee: a
 * future field added to the source entity (e.g. `answers`) cannot
 * silently leak into the client bundle.
 */

export interface AttemptViewOption {
  id: string;
  label: string;
}

export interface AttemptViewQuestion {
  id: string;
  prompt: string;
  options: AttemptViewOption[];
}

export type AttemptViewStatus = 'in_progress' | 'submitted' | 'expired';

export interface AttemptView {
  id: string;
  simulatorId: string;
  status: AttemptViewStatus;
  /** ISO string — server-issued absolute deadline, rendered client-side for UX only. */
  deadlineAt: string;
  questions: AttemptViewQuestion[];
  score: number | null;
  passed: boolean | null;
}

/** Structural shape `toAttemptView` accepts — see file docstring. */
export interface AttemptViewSource {
  id: string;
  simulatorId: string;
  status: AttemptViewStatus;
  frozenQuestions: {
    id: string;
    prompt: string;
    options: { id: string; label: string }[];
    correctOptionId: string;
  }[];
  deadlineAt: Date;
  score: number | null;
  passed: boolean | null;
}

/**
 * toAttemptView — SECURITY-CRITICAL mapper. Every field is picked
 * EXPLICITLY — never spread — so `correctOptionId` can never silently
 * leak into the client bundle, in ANY attempt status. See
 * `tests/unit/learner-ui/attempt-view.spec.ts` for the non-disclosure
 * assertion this guarantee depends on.
 */
export function toAttemptView(attempt: AttemptViewSource): AttemptView {
  return {
    id: attempt.id,
    simulatorId: attempt.simulatorId,
    status: attempt.status,
    deadlineAt: attempt.deadlineAt.toISOString(),
    questions: attempt.frozenQuestions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
    })),
    score: attempt.score,
    passed: attempt.passed,
  };
}
