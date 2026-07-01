/**
 * MarkCompleteButton — mirrors EnrollButton's `useActionState` +
 * bound-action pattern. Shows a "Marcar como completada" form when the
 * lesson is not yet completed (bound to courseId/lessonId/enrollmentId),
 * or a completed Badge instead — spec.md's "First completion" / "Idempotent
 * re-mark" scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const markLessonCompleteActionMock = vi.fn();
vi.mock('../../../src/app/dashboard/learn/actions', () => ({
  markLessonCompleteAction: (
    courseId: string,
    lessonId: string,
    enrollmentId: string,
    prevState: unknown,
    formData: FormData,
  ) => markLessonCompleteActionMock(courseId, lessonId, enrollmentId, prevState, formData),
}));

describe('MarkCompleteButton', () => {
  beforeEach(() => {
    markLessonCompleteActionMock.mockReset();
  });

  it('renders a completed Badge instead of the form when the lesson is already completed', async () => {
    const { MarkCompleteButton } = await import(
      '../../../src/app/dashboard/learn/_components/mark-complete-button'
    );

    render(
      <MarkCompleteButton
        courseId="course-1"
        lessonId="lesson-1"
        enrollmentId="enrollment-1"
        completed
      />,
    );

    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como completada' })).not.toBeInTheDocument();
  });

  it('submits markLessonCompleteAction bound to courseId, lessonId and enrollmentId when not completed', async () => {
    markLessonCompleteActionMock.mockResolvedValue({ ok: true });
    const { MarkCompleteButton } = await import(
      '../../../src/app/dashboard/learn/_components/mark-complete-button'
    );

    render(
      <MarkCompleteButton
        courseId="course-1"
        lessonId="lesson-1"
        enrollmentId="enrollment-1"
        completed={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como completada' }));

    await waitFor(() => {
      expect(markLessonCompleteActionMock).toHaveBeenCalledWith(
        'course-1',
        'lesson-1',
        'enrollment-1',
        expect.anything(),
        expect.any(FormData),
      );
    });
  });

  it('shows the Spanish error message inline when the action returns a failure', async () => {
    markLessonCompleteActionMock.mockResolvedValue({ ok: false, error: 'Ocurrió un error. Intentá de nuevo.' });
    const { MarkCompleteButton } = await import(
      '../../../src/app/dashboard/learn/_components/mark-complete-button'
    );

    render(
      <MarkCompleteButton
        courseId="course-1"
        lessonId="lesson-1"
        enrollmentId="enrollment-1"
        completed={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como completada' }));

    expect(await screen.findByText('Ocurrió un error. Intentá de nuevo.')).toBeInTheDocument();
  });
});
