import type { AssessmentView } from '@/modules/course/composition';

/**
 * QuizView — the ONLY quiz shape that may reach the 'use client'
 * `QuizRunner` boundary. `AssessmentView.questions` (from
 * `GetAssessmentUseCase`) carries `correctOptionId` — the quiz BUILDER
 * needs it, but the student-facing runner must never see it (spec.md's
 * "Result Non-Disclosure" requirement).
 */
export interface QuizViewOption {
  id: string;
  label: string;
}

export interface QuizViewQuestion {
  id: string;
  prompt: string;
  options: QuizViewOption[];
}

export interface QuizView {
  id: string;
  courseId: string;
  title: string;
  questions: QuizViewQuestion[];
}

/**
 * toQuizView — SECURITY-CRITICAL mapper. Every field is picked
 * EXPLICITLY — never spread — so a future field added to
 * `AssessmentView`/`QuizQuestion` (e.g. `correctOptionId`) cannot
 * silently leak into the client bundle. See
 * `tests/unit/learner-ui/quiz-view.spec.ts` for the non-disclosure
 * assertion this guarantee depends on.
 */
export function toQuizView(assessment: AssessmentView): QuizView {
  return {
    id: assessment.id,
    courseId: assessment.courseId,
    title: assessment.title,
    questions: assessment.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
    })),
  };
}
