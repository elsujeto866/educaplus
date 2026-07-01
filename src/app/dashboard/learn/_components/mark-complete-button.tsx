'use client';

import { useActionState } from 'react';
import { markLessonCompleteAction } from '../actions';
import type { ActionResult } from '../../courses/_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Badge } from '@/shared/ui/atoms/badge';

const initialState: ActionResult = { ok: true };

interface MarkCompleteButtonProps {
  courseId: string;
  lessonId: string;
  enrollmentId: string;
  /** Server-derived completion state — the source of truth after a
   * successful mark-complete (Next.js refreshes the route via
   * `revalidatePath` in the Server Action, re-rendering the parent Server
   * Component with the updated value). */
  completed: boolean;
}

/**
 * `'use client'` island — mirrors `EnrollButton`'s bound-action +
 * `useActionState` pattern. Renders a completed `Badge` when the lesson is
 * already done (spec.md's "Idempotent re-mark" scenario never needs the
 * form again); otherwise a "Marcar como completada" form bound to
 * `courseId`/`lessonId`/`enrollmentId`.
 */
export function MarkCompleteButton({
  courseId,
  lessonId,
  enrollmentId,
  completed,
}: MarkCompleteButtonProps) {
  const boundAction = markLessonCompleteAction.bind(null, courseId, lessonId, enrollmentId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  if (completed) {
    return <Badge variant="success">Completada</Badge>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Marcando...' : 'Marcar como completada'}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
