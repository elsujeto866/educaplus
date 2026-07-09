'use client';

import { useActionState } from 'react';
import { startTrackStepAttemptAction } from '../actions';
import type { ActionResult } from '../../../../../simulators/_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';

interface StartTrackStepButtonProps {
  simulatorId: string;
}

const initialState: ActionResult = { ok: true };

/**
 * 'use client' island — the level-map's "Comenzar" trigger for an unlocked
 * step. Verbatim mirror of `StartAttemptButton`, bound to
 * `startTrackStepAttemptAction` (the guarded track-context start path)
 * instead of the standalone `startAttemptAction`.
 */
export function StartTrackStepButton({ simulatorId }: StartTrackStepButtonProps) {
  const boundAction = startTrackStepAttemptAction.bind(null, simulatorId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Iniciando...' : 'Comenzar'}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
