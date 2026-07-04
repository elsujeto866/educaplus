'use client';

import { useActionState } from 'react';
import { updateSimulatorAction } from '../../actions';
import type { ActionResult } from '../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface SimulatorEditFormProps {
  simulatorId: string;
  title: string;
  description: string;
  questionCount: number;
  passingScore: number;
  timeLimitMinutes: number;
  attemptLimit: number;
  topicFilter: string[];
  topics: string[];
}

/**
 * 'use client' island — mirrors `create-simulator-form.tsx`, pre-filled
 * with the current values. Stays on the edit page on success (no
 * redirect), same shape as `BankEditForm`.
 */
export function SimulatorEditForm({
  simulatorId,
  title,
  description,
  questionCount,
  passingScore,
  timeLimitMinutes,
  attemptLimit,
  topicFilter,
  topics,
}: SimulatorEditFormProps) {
  const boundAction = updateSimulatorAction.bind(null, simulatorId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;
  const selectedTopics = new Set(topicFilter);

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
            rows={3}
            disabled={isPending}
          />
        </FormField>
        <FormField label="Cantidad de preguntas" htmlFor="questionCount">
          <Input
            id="questionCount"
            name="questionCount"
            type="number"
            min={1}
            step={1}
            defaultValue={questionCount}
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
            defaultValue={passingScore}
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
            defaultValue={timeLimitMinutes}
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
            defaultValue={attemptLimit}
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
                  defaultChecked={selectedTopics.has(topic)}
                  className="h-4 w-4 accent-primary"
                  disabled={isPending}
                />
                {topic}
              </label>
            ))}
          </fieldset>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </form>
    </Card>
  );
}
