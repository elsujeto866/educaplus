'use client';

import { useActionState } from 'react';
import { updateCourseAction } from '../../actions';
import type { ActionResult } from '../../_lib/action-result';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { FormField } from '@/shared/ui/molecules/form-field';
import { Card } from '@/shared/ui/atoms/card';

const initialState: ActionResult = { ok: true };

interface CourseEditFormProps {
  courseId: string;
  title: string;
  description: string;
}

/**
 * 'use client' island — mirrors `new/_components/create-course-form.tsx`
 * but binds `courseId` (the action needs it; `useActionState` only feeds
 * `formData`) and prefills both fields for editing. Stays on the detail
 * page on success (no redirect) — `updateCourseAction` only revalidates.
 */
export function CourseEditForm({ courseId, title, description }: CourseEditFormProps) {
  const boundAction = updateCourseAction.bind(null, courseId);
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
