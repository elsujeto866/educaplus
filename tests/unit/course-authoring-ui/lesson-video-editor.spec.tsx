/**
 * LessonVideoEditor behavioral tests — mirrors lesson-text-editor.spec.tsx.
 * The real `updateLessonVideoUrlAction` is mocked.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const updateLessonVideoUrlActionMock =
  vi.fn<(courseId: string, lessonId: string, prev: ActionResult, formData: FormData) => Promise<ActionResult>>();
vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  updateLessonVideoUrlAction: (courseId: string, lessonId: string, prev: ActionResult, formData: FormData) =>
    updateLessonVideoUrlActionMock(courseId, lessonId, prev, formData),
}));

describe('LessonVideoEditor', () => {
  it('prefills the URL input from initialUrl', async () => {
    const { LessonVideoEditor } = await import(
      '../../../src/app/dashboard/courses/[courseId]/lessons/[lessonId]/_components/lesson-video-editor'
    );
    render(<LessonVideoEditor courseId="course-1" lessonId="lesson-1" initialUrl="https://youtube.com/watch?v=abc" />);

    expect(screen.getByLabelText(/URL del video/)).toHaveValue('https://youtube.com/watch?v=abc');
  });

  it('shows the Spanish error returned by the action after a failed submit', async () => {
    updateLessonVideoUrlActionMock.mockResolvedValue({ ok: false, error: 'Ingresá una URL válida.' });
    const { LessonVideoEditor } = await import(
      '../../../src/app/dashboard/courses/[courseId]/lessons/[lessonId]/_components/lesson-video-editor'
    );
    render(<LessonVideoEditor courseId="course-1" lessonId="lesson-1" initialUrl="" />);

    const form = screen.getByRole('button', { name: 'Guardar URL' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ingresá una URL válida.');
    });
    expect(updateLessonVideoUrlActionMock).toHaveBeenCalledWith(
      'course-1',
      'lesson-1',
      expect.anything(),
      expect.any(FormData),
    );
  });
});
