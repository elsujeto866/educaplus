/**
 * CourseEditForm behavioral tests — mirrors create-course-form.spec.tsx.
 * The real `updateCourseAction` is mocked so this exercises the
 * component's OWN logic: prefilled fields, error display via
 * `useActionState`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const updateCourseActionMock =
  vi.fn<(courseId: string, prev: ActionResult, formData: FormData) => Promise<ActionResult>>();
vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  updateCourseAction: (courseId: string, prev: ActionResult, formData: FormData) =>
    updateCourseActionMock(courseId, prev, formData),
}));

describe('CourseEditForm', () => {
  it('prefills title and description from props', async () => {
    const { CourseEditForm } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-edit-form'
    );
    render(<CourseEditForm courseId="course-1" title="Curso original" description="Descripción original" />);

    expect(screen.getByLabelText('Título')).toHaveValue('Curso original');
    expect(screen.getByLabelText('Descripción (opcional)')).toHaveValue('Descripción original');
  });

  it('shows the Spanish error returned by the action after a failed submit', async () => {
    updateCourseActionMock.mockResolvedValue({ ok: false, error: 'Ya existe un curso con ese título.' });
    const { CourseEditForm } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-edit-form'
    );
    render(<CourseEditForm courseId="course-1" title="Curso original" description="" />);

    const form = screen.getByRole('button', { name: 'Guardar cambios' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un curso con ese título.');
    });
    expect(updateCourseActionMock).toHaveBeenCalledWith('course-1', expect.anything(), expect.any(FormData));
  });
});
