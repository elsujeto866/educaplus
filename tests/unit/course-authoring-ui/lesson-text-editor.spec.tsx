/**
 * LessonTextEditor behavioral tests — mirrors course-edit-form.spec.tsx.
 * The real `updateLessonBodyAction` is mocked so this exercises the
 * component's OWN logic: prefilled textarea, error display via
 * `useActionState`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const updateLessonBodyActionMock =
  vi.fn<(courseId: string, lessonId: string, prev: ActionResult, formData: FormData) => Promise<ActionResult>>();
vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  updateLessonBodyAction: (courseId: string, lessonId: string, prev: ActionResult, formData: FormData) =>
    updateLessonBodyActionMock(courseId, lessonId, prev, formData),
}));

describe('LessonTextEditor', () => {
  it('prefills the textarea from initialValue', async () => {
    const { LessonTextEditor } = await import(
      '../../../src/app/dashboard/courses/[courseId]/lessons/[lessonId]/_components/lesson-text-editor'
    );
    render(<LessonTextEditor courseId="course-1" lessonId="lesson-1" initialValue="# Contenido inicial" />);

    expect(screen.getByLabelText('Contenido (markdown)')).toHaveValue('# Contenido inicial');
  });

  it('shows the Spanish error returned by the action after a failed submit', async () => {
    updateLessonBodyActionMock.mockResolvedValue({ ok: false, error: 'El contenido es demasiado largo.' });
    const { LessonTextEditor } = await import(
      '../../../src/app/dashboard/courses/[courseId]/lessons/[lessonId]/_components/lesson-text-editor'
    );
    render(<LessonTextEditor courseId="course-1" lessonId="lesson-1" initialValue="" />);

    const form = screen.getByRole('button', { name: 'Guardar contenido' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El contenido es demasiado largo.');
    });
    expect(updateLessonBodyActionMock).toHaveBeenCalledWith(
      'course-1',
      'lesson-1',
      expect.anything(),
      expect.any(FormData),
    );
  });
});
