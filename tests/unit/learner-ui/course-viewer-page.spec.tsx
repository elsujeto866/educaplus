/**
 * Course viewer page (`dashboard/learn/courses/[courseId]/page.tsx`) tests
 * — spec.md's "Course Viewer" domain: enrollment-gated structure. Not
 * enrolled → course info + enroll CTA only, no lesson links exposed.
 * Enrolled → modules/lessons in position order + progress, "Curso
 * completado" banner at 100%. Missing course → notFound().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const getEnrolledCourseExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    getEnrolledCourse: { execute: getEnrolledCourseExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

vi.mock('../../../src/app/dashboard/learn/_components/enroll-button', () => ({
  EnrollButton: ({ courseId }: { courseId: string }) => <button>Inscribirme-{courseId}</button>,
}));

class FakeNotFoundSignal extends Error {}
const notFoundMock = vi.fn(() => {
  throw new FakeNotFoundSignal('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

function baseView(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    course: { id: 'course-1', title: 'Intro a React', description: 'Bases del framework' },
    modules: [
      {
        id: 'module-1',
        title: 'Módulo 1',
        description: null,
        position: 0,
        lessons: [
          { id: 'lesson-1', title: 'Lección 1', type: 'video', position: 0, completed: false },
          { id: 'lesson-2', title: 'Lección 2', type: 'text', position: 1, completed: true },
        ],
      },
    ],
    progressPercent: 50,
    isEnrolled: true,
    enrollmentId: 'enrollment-1',
    ...overrides,
  };
}

describe('Course viewer page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    getEnrolledCourseExecuteMock.mockReset();
    notFoundMock.mockClear();
  });

  it('calls notFound() when the course does not exist', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(null);
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    await expect(
      CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }),
    ).rejects.toThrow(FakeNotFoundSignal);
    expect(notFoundMock).toHaveBeenCalled();
  });

  it('shows course info and an enroll CTA (no lesson links) when not enrolled', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(
      baseView({ isEnrolled: false, enrollmentId: null, progressPercent: 0 }),
    );
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    render(await CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }));

    expect(screen.getByText('Intro a React')).toBeInTheDocument();
    expect(screen.getByText('Inscribirme-course-1')).toBeInTheDocument();
    expect(screen.queryByText('Lección 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Lección/ })).not.toBeInTheDocument();
  });

  it('renders modules and lessons in order with progress when enrolled', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(baseView());
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    render(await CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }));

    expect(screen.getByText('Módulo 1')).toBeInTheDocument();
    const lessonLink1 = screen.getByRole('link', { name: /Lección 1/ });
    expect(lessonLink1).toHaveAttribute(
      'href',
      '/dashboard/learn/courses/course-1/lessons/lesson-1',
    );
    const lessonLink2 = screen.getByRole('link', { name: /Lección 2/ });
    expect(lessonLink2).toHaveAttribute(
      'href',
      '/dashboard/learn/courses/course-1/lessons/lesson-2',
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.queryByText('Curso completado')).not.toBeInTheDocument();
  });

  it('shows a "Curso completado" banner when progress is 100%', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(baseView({ progressPercent: 100 }));
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    render(await CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }));

    expect(screen.getByText('Curso completado')).toBeInTheDocument();
  });
});
