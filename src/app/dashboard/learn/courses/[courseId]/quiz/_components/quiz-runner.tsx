'use client';

import { useActionState, useState } from 'react';
import { saveAttemptAction } from '../actions';
import type { QuizAttemptState } from '../_lib/quiz-attempt-result';
import type { QuizView } from '../_lib/quiz-view';
import { Button } from '@/shared/ui/atoms/button';
import { QuizQuestion } from './quiz-question';
import { QuizResult } from './quiz-result';

interface QuizRunnerProps {
  courseId: string;
  quiz: QuizView;
  /** The caller's most recent PASSED attempt, or `null` if they never
   *  passed. Seeds the initial `useActionState` value so a passed
   *  indicator renders immediately on load (spec.md's "Already-passed
   *  student sees passed state on load"). */
  latest: { score: number; passed: boolean } | null;
}

/**
 * `'use client'` island — the student quiz runner. A controlled `answers`
 * map gates submit until every question has a selection (spec.md's
 * "Submit stays disabled until fully answered"); a hidden JSON `payload`
 * field carries `{questionId,selectedOptionId}[]` to `saveAttemptAction`.
 * "Retake" re-opens the form and clears selections without a server
 * round-trip — a fresh submit is simply a new attempt row (backend allows
 * unlimited retakes). Only `QuizView` (never `AssessmentView`) reaches
 * this component — see `_lib/quiz-view.ts`.
 */
export function QuizRunner({ courseId, quiz, latest }: QuizRunnerProps) {
  const boundAction = saveAttemptAction.bind(null, courseId);
  const seedState: QuizAttemptState = latest
    ? { ok: true, score: latest.score, passed: latest.passed }
    : { ok: false, error: '' };
  const [state, formAction, isPending] = useActionState(boundAction, seedState);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [retake, setRetake] = useState(false);

  // A fresh action result always supersedes a pending retake — the next
  // successful (or failed) submission should render its own outcome, not
  // stay pinned to the "retake" override from a previous view. Adjusting
  // state during render (React's documented pattern for "reset state when
  // a prop/value changes") instead of an effect, so the reset is visible
  // in the SAME render as the new `state` — no effect-triggered re-render.
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    if (retake) setRetake(false);
  }

  if (state.ok && !retake) {
    return (
      <QuizResult
        score={state.score}
        passed={state.passed}
        onRetake={() => {
          setAnswers({});
          setRetake(true);
        }}
      />
    );
  }

  const allAnswered = quiz.questions.every((question) => answers[question.id]);
  const payload = JSON.stringify(
    quiz.questions.map((question) => ({
      questionId: question.id,
      selectedOptionId: answers[question.id] ?? '',
    })),
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {quiz.questions.map((question, index) => (
        <QuizQuestion
          key={question.id}
          index={index}
          question={question}
          selectedOptionId={answers[question.id]}
          disabled={isPending}
          onSelect={(optionId) =>
            setAnswers((prev) => ({ ...prev, [question.id]: optionId }))
          }
        />
      ))}
      <input type="hidden" name="payload" value={payload} readOnly />
      {!state.ok && state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending || !allAnswered}>
        {isPending ? 'Enviando...' : 'Enviar respuestas'}
      </Button>
    </form>
  );
}
