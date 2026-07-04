'use client';

import { useActionState } from 'react';
import { updateBankAction } from '../../../actions';
import type { ActionResult } from '../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface BankEditFormProps {
  bankId: string;
  title: string;
  description: string;
}

/**
 * 'use client' island — mirrors `courses/[courseId]/_components/course-edit-form.tsx`.
 * Stays on the detail page on success (no redirect).
 */
export function BankEditForm({ bankId, title, description }: BankEditFormProps) {
  const boundAction = updateBankAction.bind(null, bankId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Título" htmlFor="title" error={error}>
          <Input
            id="title"
            name="title"
            defaultValue={title}
            required
            minLength={3}
            maxLength={200}
            disabled={isPending}
          />
        </FormField>
        <FormField label="Descripción (opcional)" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={description}
            maxLength={2000}
            rows={4}
            disabled={isPending}
          />
        </FormField>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </form>
    </Card>
  );
}
