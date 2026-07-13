'use client';

import { useActionState } from 'react';
import { createTrackAction } from '../../actions';
import type { ActionResult } from '../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { FormField } from '@/shared/ui/molecules/form-field';

const initialState: ActionResult = { ok: true };

/**
 * 'use client' island — the only interactive piece of
 * `tracks/new/page.tsx`. Mirrors `simulators/new/_components/create-bank-form.tsx`.
 */
export function CreateTrackForm() {
  const [state, formAction, isPending] = useActionState(createTrackAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Título" htmlFor="title" error={error}>
        <Input id="title" name="title" required minLength={3} maxLength={200} disabled={isPending} />
      </FormField>
      <FormField label="Descripción (opcional)" htmlFor="description">
        <Textarea id="description" name="description" maxLength={2000} rows={4} disabled={isPending} />
      </FormField>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creando...' : 'Crear ruta de estudio'}
      </Button>
    </form>
  );
}
