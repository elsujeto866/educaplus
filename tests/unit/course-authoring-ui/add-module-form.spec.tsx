/**
 * AddModuleForm behavioral tests — mirrors create-course-form.spec.tsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const addModuleActionMock =
  vi.fn<(courseId: string, prev: ActionResult, formData: FormData) => Promise<ActionResult>>();
vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  addModuleAction: (courseId: string, prev: ActionResult, formData: FormData) =>
    addModuleActionMock(courseId, prev, formData),
}));

describe('AddModuleForm', () => {
  it('renders a labeled title field and a submit button', async () => {
    const { AddModuleForm } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/add-module-form'
    );
    render(<AddModuleForm courseId="course-1" />);

    expect(screen.getByLabelText('Título del módulo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar módulo' })).toBeInTheDocument();
  });

  it('shows the Spanish error returned by the action after a failed submit', async () => {
    addModuleActionMock.mockResolvedValue({ ok: false, error: 'El título debe tener al menos 3 caracteres.' });
    const { AddModuleForm } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/add-module-form'
    );
    render(<AddModuleForm courseId="course-1" />);

    fireEvent.change(screen.getByLabelText('Título del módulo'), { target: { value: 'ab' } });
    const form = screen.getByRole('button', { name: 'Agregar módulo' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El título debe tener al menos 3 caracteres.');
    });
    expect(addModuleActionMock).toHaveBeenCalledWith('course-1', expect.anything(), expect.any(FormData));
  });
});
