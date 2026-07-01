'use client';

import { useActionState } from 'react';
import { enrollAction } from '../actions';
import type { ActionResult } from '../../courses/_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';

const initialState: ActionResult = { ok: true };

interface EnrollButtonProps {
  courseId: string;
}

/**
 * 'use client' island — the only interactive piece of a catalog course
 * card. Mirrors `AddModuleForm`'s bound-action + `useActionState` pattern.
 * `enrollAction` redirects to the course viewer on success; on failure
 * (e.g. already enrolled) the Spanish error renders inline instead of
 * hitting Next's generic error boundary.
 */
export function EnrollButton({ courseId }: EnrollButtonProps) {
  const boundAction = enrollAction.bind(null, courseId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Inscribiendo...' : 'Inscribirme'}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
