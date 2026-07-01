/**
 * CreateCourseForm behavioral tests.
 *
 * The real `createCourseAction` Server Action is mocked so this test
 * exercises the component's OWN rendering logic (labeled fields, error
 * display driven by `useActionState`) without depending on Next's server
 * runtime or a real network round-trip.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const createCourseActionMock = vi.fn<(prev: ActionResult, formData: FormData) => Promise<ActionResult>>();
vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  createCourseAction: (prev: ActionResult, formData: FormData) => createCourseActionMock(prev, formData),
}));

describe('CreateCourseForm', () => {
  it('renders labeled title and description fields plus a submit button', async () => {
    const { CreateCourseForm } = await import(
      '../../../src/app/dashboard/courses/new/_components/create-course-form'
    );
    render(<CreateCourseForm />);

    expect(screen.getByLabelText('Título')).toBeInTheDocument();
    expect(screen.getByLabelText('Descripción (opcional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear curso' })).toBeInTheDocument();
  });

  it('shows the Spanish error returned by the action after a failed submit', async () => {
    createCourseActionMock.mockResolvedValue({ ok: false, error: 'Ya existe un curso con ese título.' });
    const { CreateCourseForm } = await import(
      '../../../src/app/dashboard/courses/new/_components/create-course-form'
    );
    render(<CreateCourseForm />);

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Curso repetido' } });
    const form = screen.getByRole('button', { name: 'Crear curso' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un curso con ese título.');
    });
  });
});
