/**
 * AddLessonForm behavioral tests — mirrors add-module-form.spec.tsx, plus
 * the type-conditional external-URL field.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const addLessonActionMock =
  vi.fn<(courseId: string, moduleId: string, prev: ActionResult, formData: FormData) => Promise<ActionResult>>();
vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  addLessonAction: (courseId: string, moduleId: string, prev: ActionResult, formData: FormData) =>
    addLessonActionMock(courseId, moduleId, prev, formData),
}));

describe('AddLessonForm', () => {
  it('renders title and type fields, with the video URL field hidden by default (type=text)', async () => {
    const { AddLessonForm } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/add-lesson-form'
    );
    render(<AddLessonForm courseId="course-1" moduleId="module-1" />);

    expect(screen.getByLabelText('Título de la lección')).toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toHaveValue('text');
    expect(screen.queryByLabelText('URL del video')).not.toBeInTheDocument();
  });

  it('shows the external URL field once the type is switched to video', async () => {
    const { AddLessonForm } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/add-lesson-form'
    );
    render(<AddLessonForm courseId="course-1" moduleId="module-1" />);

    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'video' } });

    expect(screen.getByLabelText('URL del video')).toBeInTheDocument();
  });

  it('calls addLessonAction with courseId and moduleId bound on submit', async () => {
    addLessonActionMock.mockResolvedValue({ ok: true });
    const { AddLessonForm } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/add-lesson-form'
    );
    render(<AddLessonForm courseId="course-1" moduleId="module-1" />);

    const form = screen.getByRole('button', { name: 'Agregar lección' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(addLessonActionMock).toHaveBeenCalledWith('course-1', 'module-1', expect.anything(), expect.any(FormData));
  });
});
