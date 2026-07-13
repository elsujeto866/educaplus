'use client';

import { useActionState } from 'react';
import { addTrackStepAction } from '../../actions';
import type { ActionResult } from '../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Select } from '@/shared/ui/atoms/select';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface SimulatorOption {
  id: string;
  title: string;
}

interface AddTrackStepFormProps {
  trackId: string;
  simulators: SimulatorOption[];
}

/**
 * 'use client' island — appends an existing PUBLISHED simulator as the
 * track's next step. `simulators` is the caller-filtered "available to add"
 * list (only published, not already a step of THIS track); the backend
 * (`AddSimulatorToTrackStepUseCase`) still enforces publish status and
 * cross-track uniqueness server-side, surfaced here via `error` — mirrors
 * `add-lesson-form.tsx`'s island shape.
 */
export function AddTrackStepForm({ trackId, simulators }: AddTrackStepFormProps) {
  const boundAction = addTrackStepAction.bind(null, trackId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  if (simulators.length === 0) {
    return (
      <Card className="text-center text-sm text-muted-foreground">
        No hay simuladores publicados disponibles para agregar.
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Agregar simulador" htmlFor="simulatorId" error={error}>
          <Select id="simulatorId" name="simulatorId" required disabled={isPending} defaultValue="">
            <option value="" disabled>
              Elegí un simulador
            </option>
            {simulators.map((simulator) => (
              <option key={simulator.id} value={simulator.id}>
                {simulator.title}
              </option>
            ))}
          </Select>
        </FormField>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Agregando...' : 'Agregar paso'}
        </Button>
      </form>
    </Card>
  );
}
