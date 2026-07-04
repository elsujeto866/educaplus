'use client';

import { useActionState } from 'react';
import { createSimulatorAction } from '../../actions';
import type { ActionResult } from '../../../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface CreateSimulatorFormProps {
  bankId: string;
  /** Distinct topics found among the bank's questions — empty when none are tagged. */
  topics: string[];
}

/**
 * 'use client' island — the only interactive piece of `simulators/new/page.tsx`.
 * Mirrors `create-bank-form.tsx`'s useActionState shape. `selectionStrategy`
 * has no field — the schema enum currently only supports 'random'
 * (Decision 7), so `createSimulatorAction` hardcodes it server-side.
 */
export function CreateSimulatorForm({ bankId, topics }: CreateSimulatorFormProps) {
  const boundAction = createSimulatorAction.bind(null, bankId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Título" htmlFor="title" error={error}>
          <Input id="title" name="title" required minLength={3} maxLength={200} disabled={isPending} />
        </FormField>
        <FormField label="Descripción (opcional)" htmlFor="description">
          <Textarea id="description" name="description" maxLength={2000} rows={3} disabled={isPending} />
        </FormField>
        <FormField label="Cantidad de preguntas" htmlFor="questionCount">
          <Input
            id="questionCount"
            name="questionCount"
            type="number"
            min={1}
            step={1}
            defaultValue={10}
            required
            disabled={isPending}
          />
        </FormField>
        <FormField label="Puntaje de aprobación (0-100)" htmlFor="passingScore">
          <Input
            id="passingScore"
            name="passingScore"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={70}
            required
            disabled={isPending}
          />
        </FormField>
        <FormField label="Límite de tiempo (minutos)" htmlFor="timeLimitMinutes">
          <Input
            id="timeLimitMinutes"
            name="timeLimitMinutes"
            type="number"
            min={1}
            step={1}
            defaultValue={30}
            required
            disabled={isPending}
          />
        </FormField>
        <FormField label="Límite de intentos por estudiante" htmlFor="attemptLimit">
          <Input
            id="attemptLimit"
            name="attemptLimit"
            type="number"
            min={1}
            step={1}
            defaultValue={3}
            required
            disabled={isPending}
          />
        </FormField>
        {topics.length > 0 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              Filtrar por tema (opcional — sin selección usa todo el banco)
            </legend>
            {topics.map((topic) => (
              <label key={topic} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="topics"
                  value={topic}
                  className="h-4 w-4 accent-primary"
                  disabled={isPending}
                />
                {topic}
              </label>
            ))}
          </fieldset>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="issuesCertificate"
            defaultChecked
            className="h-4 w-4 accent-primary"
            disabled={isPending}
          />
          Emitir certificado al aprobar
        </label>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creando...' : 'Crear simulacro'}
        </Button>
      </form>
    </Card>
  );
}
