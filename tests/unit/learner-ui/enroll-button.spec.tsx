/**
 * EnrollButton — mirrors AddModuleForm's `useActionState` + bound-action
 * pattern (tests/unit/course-authoring-ui/add-module-form.spec.tsx style).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const enrollActionMock = vi.fn();
vi.mock('../../../src/app/dashboard/learn/actions', () => ({
  enrollAction: (courseId: string, prevState: unknown, formData: FormData) =>
    enrollActionMock(courseId, prevState, formData),
}));

describe('EnrollButton', () => {
  beforeEach(() => {
    enrollActionMock.mockReset();
  });

  it('submits enrollAction bound to the courseId', async () => {
    enrollActionMock.mockResolvedValue({ ok: true });
    const { EnrollButton } = await import(
      '../../../src/app/dashboard/learn/_components/enroll-button'
    );

    render(<EnrollButton courseId="course-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }));

    await waitFor(() => {
      expect(enrollActionMock).toHaveBeenCalledWith(
        'course-1',
        expect.anything(),
        expect.any(FormData),
      );
    });
  });

  it('shows the Spanish error message inline when enrollAction returns a failure', async () => {
    enrollActionMock.mockResolvedValue({ ok: false, error: 'Ya estás inscripto en este curso.' });
    const { EnrollButton } = await import(
      '../../../src/app/dashboard/learn/_components/enroll-button'
    );

    render(<EnrollButton courseId="course-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }));

    expect(await screen.findByText('Ya estás inscripto en este curso.')).toBeInTheDocument();
  });
});
