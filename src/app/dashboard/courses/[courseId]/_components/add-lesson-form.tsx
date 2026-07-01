'use client';

import { useActionState, useState } from 'react';
import { addLessonAction } from '../../actions';
import type { ActionResult } from '../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Select } from '@/shared/ui/atoms/select';
import { FormField } from '@/shared/ui/molecules/form-field';

const initialState: ActionResult = { ok: true };

type LessonTypeChoice = 'text' | 'video';

interface AddLessonFormProps {
  courseId: string;
  moduleId: string;
}

/**
 * 'use client' island — appends a new lesson to a module. The external-URL
 * field is only shown (and only required, via the `required` attribute)
 * when the instructor picks "Video" — mirrors `addLessonAction`'s server-side
 * refine validation (design.md §3, `courses/[courseId]/_components/`).
 * On success the action redirects straight to the new lesson's editor page.
 */
export function AddLessonForm({ courseId, moduleId }: AddLessonFormProps) {
  const boundAction = addLessonAction.bind(null, courseId, moduleId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [type, setType] = useState<LessonTypeChoice>('text');
  const error = state.ok ? undefined : state.error;
  const fieldId = `${moduleId}-lesson`;

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-3">
      <FormField label="Título de la lección" htmlFor={`${fieldId}-title`} error={error}>
        <Input
          id={`${fieldId}-title`}
          name="title"
          required
          minLength={3}
          maxLength={200}
          disabled={isPending}
        />
      </FormField>
      <FormField label="Tipo" htmlFor={`${fieldId}-type`}>
        <Select
          id={`${fieldId}-type`}
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as LessonTypeChoice)}
          disabled={isPending}
        >
          <option value="text">Texto</option>
          <option value="video">Video</option>
        </Select>
      </FormField>
      {type === 'video' ? (
        <FormField label="URL del video" htmlFor={`${fieldId}-url`}>
          <Input
            id={`${fieldId}-url`}
            name="externalUrl"
            type="url"
            placeholder="https://..."
            required
            disabled={isPending}
          />
        </FormField>
      ) : null}
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? 'Agregando...' : 'Agregar lección'}
      </Button>
    </form>
  );
}
