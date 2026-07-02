/**
 * Course viewer page (`dashboard/learn/courses/[courseId]/page.tsx`) tests
 * — spec.md's "Course Viewer" domain: enrollment-gated structure. Not
 * enrolled → course info + enroll CTA in the main pane, and the sidebar
 * syllabus (modules + lesson titles) rendered as plain labels — no lesson
 * links ANYWHERE on the page (main or sidebar), since non-enrolled
 * learners cannot open lesson content. Enrolled → modules/lessons in
 * position order + progress in the main pane, AND clickable lesson links
 * in the sidebar. "Curso completado" banner at 100%. Missing course →
 * notFound().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const getEnrolledCourseExecuteMock = vi.fn();
const getAssessmentExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    getEnrolledCourse: { execute: getEnrolledCourseExecuteMock },
    getAssessment: { execute: getAssessmentExecuteMock },
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
// `usePathname` is required here too: the page now renders `CourseOutlineNav`
// (course-outline-sidebar slice) through `AppShell`'s `sidebar` slot.
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
  usePathname: () => '/dashboard/learn/courses/course-1',
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
    getAssessmentExecuteMock.mockReset().mockResolvedValue(null);
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

  it('shows course info and an enroll CTA, and NO lesson links anywhere (main or sidebar), when not enrolled', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(
      baseView({ isEnrolled: false, enrollmentId: null, progressPercent: 0 }),
    );
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    render(await CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }));
    const main = within(screen.getByRole('main'));

    expect(main.getByText('Intro a React')).toBeInTheDocument();
    expect(main.getByText('Inscribirme-course-1')).toBeInTheDocument();
    expect(main.queryByText('Lección 1')).not.toBeInTheDocument();
    // Global (not scoped to `main`): the sidebar syllabus preview may show
    // lesson titles as plain labels, but MUST NOT render them as links —
    // non-enrolled learners cannot open lesson content.
    expect(screen.queryByRole('link', { name: /Lección/i })).not.toBeInTheDocument();
  });

  it('renders clickable lesson links in the sidebar when enrolled', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(baseView());
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    render(await CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }));
    const sidebar = within(screen.getByRole('complementary'));

    const lessonLink1 = sidebar.getByRole('link', { name: /Lección 1/ });
    expect(lessonLink1).toHaveAttribute(
      'href',
      '/dashboard/learn/courses/course-1/lessons/lesson-1',
    );
    const lessonLink2 = sidebar.getByRole('link', { name: /Lección 2/ });
    expect(lessonLink2).toHaveAttribute(
      'href',
      '/dashboard/learn/courses/course-1/lessons/lesson-2',
    );
  });

  it('renders modules and lessons in order with progress when enrolled', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(baseView());
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    render(await CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }));
    const main = within(screen.getByRole('main'));

    expect(main.getByText('Módulo 1')).toBeInTheDocument();
    const lessonLink1 = main.getByRole('link', { name: /Lección 1/ });
    expect(lessonLink1).toHaveAttribute(
      'href',
      '/dashboard/learn/courses/course-1/lessons/lesson-1',
    );
    const lessonLink2 = main.getByRole('link', { name: /Lección 2/ });
    expect(lessonLink2).toHaveAttribute(
      'href',
      '/dashboard/learn/courses/course-1/lessons/lesson-2',
    );
    expect(main.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(main.queryByText('Curso completado')).not.toBeInTheDocument();
  });

  it('shows a "Curso completado" banner when progress is 100%', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(baseView({ progressPercent: 100 }));
    const CourseViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/page')
    ).default;

    render(await CourseViewerPage({ params: Promise.resolve({ courseId: 'course-1' }) }));

    expect(within(screen.getByRole('main')).getByText('Curso completado')).toBeInTheDocument();
  });
});
