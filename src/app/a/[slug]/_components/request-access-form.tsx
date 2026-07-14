'use client';

import { useActionState } from 'react';
import { requestAccessAction } from '../actions';
import type { RequestAccessActionResult } from '../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { FormField } from '@/shared/ui/molecules/form-field';

const initialState: RequestAccessActionResult = { ok: false, error: '' };

interface RequestAccessFormProps {
  slug: string;
}

/**
 * 'use client' island — the only interactive piece of the public academy
 * page. Mirrors EnrollButton/AddModuleForm's bound-action + useActionState
 * pattern. Unlike those, success does NOT redirect (spec "Resubmission is
 * idempotent" — both a fresh submission and a duplicate stay on the page
 * with an inline Spanish confirmation, since the visitor isn't authenticated
 * and has nowhere else to go).
 */
export function RequestAccessForm({ slug }: RequestAccessFormProps) {
  const boundAction = requestAccessAction.bind(null, slug);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error || undefined;
  const message = state.ok ? state.message : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Email" htmlFor="request-access-email" error={error}>
        <Input
          id="request-access-email"
          name="email"
          type="email"
          required
          placeholder="tu@email.com"
          disabled={isPending}
        />
      </FormField>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enviando...' : 'Solicitar acceso'}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </form>
  );
}
