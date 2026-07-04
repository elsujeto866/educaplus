'use client';

import { useActionState, useRef, useState } from 'react';
import { submitAttemptAction } from '../actions';
import type { SubmitAttemptState } from '../_lib/submit-attempt-result';
import type { AttemptView } from '../_lib/attempt-view';
import { Button } from '@/shared/ui/atoms/button';
import { AttemptTimer } from './attempt-timer';
import { AttemptQuestion } from './attempt-question';
import { AttemptResult } from './attempt-result';

interface AttemptRunnerProps {
  attempt: AttemptView;
}

/**
 * 'use client' island — the timed exam runner. Mirrors `QuizRunner`'s
 * controlled-answers pattern, plus a server-issued countdown
 * (`AttemptTimer`, UX only) that auto-submits via `formRef.requestSubmit()`
 * when it reaches zero (spec.md "Timeout mid-exam": auto-submit using
 * whatever answers were recorded). The SERVER (`SubmitAttemptUseCase`)
 * remains authoritative: even if network lag delays the auto-submit past
 * `deadlineAt`, the submission is scored and marked 'expired' — never
 * rejected, never disguised as on-time.
 *
 * UNLIKE `QuizRunner`, the submit button is never disabled by
 * "not all answered" — a PARTIAL submission is valid (Decision 5:
 * unanswered questions simply count as wrong).
 *
 * If the attempt is already finished when this component mounts (status
 * !== 'in_progress' — e.g. the page's `GetAttemptUseCase` call already
 * lazily expired it), the result renders immediately with no form at all.
 */
export function AttemptRunner({ attempt }: AttemptRunnerProps) {
  const boundAction = submitAttemptAction.bind(null, attempt.id);
  const seedState: SubmitAttemptState =
    attempt.status === 'in_progress'
      ? { ok: false, error: '' }
      : {
          ok: true,
          score: attempt.score ?? 0,
          passed: attempt.passed ?? false,
          status: attempt.status,
        };
  const [state, formAction, isPending] = useActionState(boundAction, seedState);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  if (state.ok) {
    return (
      <AttemptResult
        score={state.score}
        passed={state.passed}
        status={state.status}
        certificateHref={`/dashboard/learn/simulators/${attempt.simulatorId}/certificate`}
      />
    );
  }

  const payload = JSON.stringify(
    Object.entries(answers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    })),
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <AttemptTimer deadlineAt={attempt.deadlineAt} onExpire={() => formRef.current?.requestSubmit()} />
      {attempt.questions.map((question, index) => (
        <AttemptQuestion
          key={question.id}
          index={index}
          question={question}
          selectedOptionId={answers[question.id]}
          disabled={isPending}
          onSelect={(optionId) => setAnswers((prev) => ({ ...prev, [question.id]: optionId }))}
        />
      ))}
      <input type="hidden" name="payload" value={payload} readOnly />
      {!state.ok && state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enviando...' : 'Entregar simulacro'}
      </Button>
    </form>
  );
}
