'use client';

import { useActionState } from 'react';
import { startAttemptAction } from '../actions';
import type { ActionResult } from '../../../../simulators/_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';

interface StartAttemptButtonProps {
  simulatorId: string;
}

const initialState: ActionResult = { ok: true };

/**
 * 'use client' island — "Comenzar simulacro" trigger. Uses `useActionState`
 * (mirrors `SimulatorStatusActions`'s publish button) because
 * `StartAttemptUseCase` has a real, user-facing rejection path (spec.md
 * "Attempt limit exhausted") that must surface an inline Spanish message.
 * On success the action itself calls `redirect()` — this component never
 * navigates directly.
 */
export function StartAttemptButton({ simulatorId }: StartAttemptButtonProps) {
  const boundAction = startAttemptAction.bind(null, simulatorId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Iniciando...' : 'Comenzar simulacro'}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
