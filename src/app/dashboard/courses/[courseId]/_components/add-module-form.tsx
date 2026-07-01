'use client';

import { useActionState } from 'react';
import { addModuleAction } from '../../actions';
import type { ActionResult } from '../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface AddModuleFormProps {
  courseId: string;
}

/**
 * 'use client' island — appends a new module. Uncontrolled: no local
 * "clear on success" logic here (the server revalidates and this form
 * unmounts/remounts with the page re-render, which resets the input via
 * React's key-less remount of the whole tree on navigation/revalidation).
 */
export function AddModuleForm({ courseId }: AddModuleFormProps) {
  const boundAction = addModuleAction.bind(null, courseId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Título del módulo" htmlFor="module-title" error={error}>
          <Input id="module-title" name="title" required minLength={3} maxLength={200} disabled={isPending} />
        </FormField>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Agregando...' : 'Agregar módulo'}
        </Button>
      </form>
    </Card>
  );
}
