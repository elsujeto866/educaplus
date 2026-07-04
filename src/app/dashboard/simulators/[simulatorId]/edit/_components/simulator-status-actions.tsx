'use client';

import { useActionState } from 'react';
import { publishSimulatorAction, unpublishSimulatorAction } from '../../actions';
import type { ActionResult } from '../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Card } from '@/shared/ui/atoms/card';

// Inline literal union instead of importing `Simulator`'s status type from
// the domain layer — `src/app` may not depend on `domain` directly
// (eslint-boundaries). Same rationale as `course-status-actions.tsx`.
const STATUS_LABEL: Record<'draft' | 'published', string> = {
  draft: 'Borrador',
  published: 'Publicado',
};

const initialState: ActionResult = { ok: true };

interface SimulatorStatusActionsProps {
  simulatorId: string;
  status: 'draft' | 'published';
}

/**
 * 'use client' island — status toggle. Publish uses `useActionState`
 * (unlike `CourseStatusActions`'s fire-and-forget publish) because
 * `PublishSimulatorUseCase` has a real rejection path (spec.md "Bank has
 * fewer questions than required") that must surface an inline Spanish
 * message. Unpublish stays fire-and-forget — it never rejects.
 */
export function SimulatorStatusActions({ simulatorId, status }: SimulatorStatusActionsProps) {
  const boundPublish = publishSimulatorAction.bind(null, simulatorId);
  const [state, publishFormAction, isPending] = useActionState(boundPublish, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Estado: {STATUS_LABEL[status]}</span>
        {status === 'published' ? (
          <form action={unpublishSimulatorAction.bind(null, simulatorId)}>
            <Button type="submit" variant="secondary">
              Despublicar
            </Button>
          </form>
        ) : (
          <form action={publishFormAction}>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Publicando...' : 'Publicar'}
            </Button>
          </form>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
