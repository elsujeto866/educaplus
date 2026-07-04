'use client';

import { useActionState, useRef, useState } from 'react';
import { deleteBankAction } from '../../../actions';
import type { ActionResult } from '../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Card } from '@/shared/ui/atoms/card';
import { ConfirmDialog } from '@/shared/ui/organisms/confirm-dialog';

const initialState: ActionResult = { ok: true };

interface BankDeleteActionProps {
  bankId: string;
}

/**
 * 'use client' island — delete-with-confirmation. Uses `useActionState`
 * (unlike `courses/[courseId]/_components/course-status-actions.tsx`'s
 * fire-and-forget delete) because `deleteBankAction` has a real rejection
 * path (spec.md "Delete bank referenced by a simulator") that must surface
 * an inline Spanish message instead of an unhandled rejection.
 */
export function BankDeleteAction({ bankId }: BankDeleteActionProps) {
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const boundAction = deleteBankAction.bind(null, bankId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card className="flex flex-col gap-3">
      <form ref={formRef} action={formAction} className="hidden" aria-hidden="true" />
      <Button type="button" variant="danger" onClick={() => setConfirming(true)} disabled={isPending}>
        Eliminar banco
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title="Eliminar banco"
          description="Esta acción no se puede deshacer. Se eliminarán todas las preguntas del banco."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            formRef.current?.requestSubmit();
          }}
        />
      ) : null}
    </Card>
  );
}
