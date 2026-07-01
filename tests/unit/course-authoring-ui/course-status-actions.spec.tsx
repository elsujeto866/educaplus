/**
 * CourseStatusActions behavioral tests: publish/unpublish button visibility
 * driven by `status`, and delete requires confirmation before the action
 * actually fires.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const publishCourseActionMock = vi.fn().mockResolvedValue(undefined);
const unpublishCourseActionMock = vi.fn().mockResolvedValue(undefined);
const deleteCourseActionMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  publishCourseAction: (courseId: string, formData: FormData) => publishCourseActionMock(courseId, formData),
  unpublishCourseAction: (courseId: string, formData: FormData) => unpublishCourseActionMock(courseId, formData),
  deleteCourseAction: (courseId: string, formData: FormData) => deleteCourseActionMock(courseId, formData),
}));

describe('CourseStatusActions', () => {
  beforeEach(() => {
    publishCourseActionMock.mockClear();
    unpublishCourseActionMock.mockClear();
    deleteCourseActionMock.mockClear();
  });

  it('shows a "Publicar" button (not "Despublicar") when status is draft', async () => {
    const { CourseStatusActions } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-status-actions'
    );
    render(<CourseStatusActions courseId="course-1" status="draft" />);

    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Despublicar' })).not.toBeInTheDocument();
  });

  it('shows a "Despublicar" button (not "Publicar") when status is published', async () => {
    const { CourseStatusActions } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-status-actions'
    );
    render(<CourseStatusActions courseId="course-1" status="published" />);

    expect(screen.getByRole('button', { name: 'Despublicar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
  });

  it('submitting the publish form calls publishCourseAction with the courseId', async () => {
    const { CourseStatusActions } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-status-actions'
    );
    render(<CourseStatusActions courseId="course-1" status="draft" />);

    const form = screen.getByRole('button', { name: 'Publicar' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(publishCourseActionMock).toHaveBeenCalledWith('course-1', expect.any(FormData));
    });
  });

  it('does NOT call deleteCourseAction just by clicking "Eliminar curso" (requires confirmation)', async () => {
    const { CourseStatusActions } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-status-actions'
    );
    render(<CourseStatusActions courseId="course-1" status="draft" />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar curso' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(deleteCourseActionMock).not.toHaveBeenCalled();
  });

  it('calls deleteCourseAction only after confirming in the dialog', async () => {
    const { CourseStatusActions } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-status-actions'
    );
    render(<CourseStatusActions courseId="course-1" status="draft" />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar curso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(deleteCourseActionMock).toHaveBeenCalledWith('course-1', expect.any(FormData));
    });
  });

  it('cancelling the dialog closes it without calling deleteCourseAction', async () => {
    const { CourseStatusActions } = await import(
      '../../../src/app/dashboard/courses/[courseId]/_components/course-status-actions'
    );
    render(<CourseStatusActions courseId="course-1" status="draft" />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar curso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteCourseActionMock).not.toHaveBeenCalled();
  });
});
