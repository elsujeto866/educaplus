'use client';

import { useActionState } from 'react';
import { updateLessonVideoUrlAction } from '../../../../actions';
import type { ActionResult } from '../../../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface LessonVideoEditorProps {
  courseId: string;
  lessonId: string;
  initialUrl: string;
}

/**
 * 'use client' island — video lesson external-URL editor. Only edits
 * `externalUrl`; Cloudflare-pipeline fields (`cloudflareUid`,
 * `durationSeconds`, `thumbnailUrl`) are preserved server-side by
 * `updateLessonVideoUrlAction` (fetches the existing lesson and merges).
 */
export function LessonVideoEditor({ courseId, lessonId, initialUrl }: LessonVideoEditorProps) {
  const boundAction = updateLessonVideoUrlAction.bind(null, courseId, lessonId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const error = state.ok ? undefined : state.error;

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="URL del video (YouTube, Vimeo, etc.)" htmlFor="externalUrl" error={error}>
          <Input
            id="externalUrl"
            name="externalUrl"
            type="url"
            defaultValue={initialUrl}
            placeholder="https://..."
            disabled={isPending}
          />
        </FormField>
        {initialUrl ? (
          <p className="text-sm text-muted-foreground">
            URL actual:{' '}
            <a href={initialUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {initialUrl}
            </a>
          </p>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar URL'}
        </Button>
      </form>
    </Card>
  );
}
