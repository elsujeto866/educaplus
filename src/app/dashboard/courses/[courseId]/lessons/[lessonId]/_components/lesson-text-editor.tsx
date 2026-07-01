'use client';

import { useActionState } from 'react';
import { updateLessonBodyAction } from '../../../../actions';
import type { ActionResult } from '../../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface LessonTextEditorProps {
  courseId: string;
  lessonId: string;
  initialValue: string;
}

/**
 * 'use client' island — text lesson body editor. Binds `courseId` and
 * `lessonId` (the action needs both for revalidation); prefills the
 * textarea with the current markdown value extracted from the JSONB
 * envelope by the page (server-side, via `extractMarkdown`).
 */
export function LessonTextEditor({ courseId, lessonId, initialValue }: LessonTextEditorProps) {
  const boundAction = updateLessonBodyAction.bind(null, courseId, lessonId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Contenido (markdown)" htmlFor="body" error={error}>
          <Textarea id="body" name="body" defaultValue={initialValue} rows={12} disabled={isPending} />
        </FormField>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar contenido'}
        </Button>
      </form>
    </Card>
  );
}
