/**
 * LearnerHome behavioral tests — spec.md "My Courses" domain: student sees
 * only their own enrolled courses with progress, or an empty-state CTA
 * into the catalog when they have none.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const listMyEnrollmentsExecuteMock = vi.fn();
const getEnrolledCourseExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    listMyEnrollments: { execute: listMyEnrollmentsExecuteMock },
    getEnrolledCourse: { execute: getEnrolledCourseExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

function enrolledCourseView(courseId: string, title: string, progressPercent: number) {
  return {
    course: { id: courseId, title, description: null },
    modules: [],
    progressPercent,
    isEnrolled: true,
    enrollmentId: `enrollment-${courseId}`,
  };
}

describe('LearnerHome', () => {
  beforeEach(() => {
    listMyEnrollmentsExecuteMock.mockReset();
    getEnrolledCourseExecuteMock.mockReset();
  });

  it('renders the empty-state message and a catalog link when the student has no enrollments', async () => {
    listMyEnrollmentsExecuteMock.mockResolvedValue([]);
    const { LearnerHome } = await import('../../../src/app/dashboard/_components/learner-home');

    render(await LearnerHome({ ctx: studentCtx }));

    expect(
      screen.getByText('Todavía no estás inscripto en ningún curso.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /catálogo/i }).length).toBeGreaterThan(0);
    expect(getEnrolledCourseExecuteMock).not.toHaveBeenCalled();
  });

  it('renders one CourseCard per enrollment with its progress', async () => {
    listMyEnrollmentsExecuteMock.mockResolvedValue([
      { courseId: 'course-1' },
      { courseId: 'course-2' },
    ]);
    getEnrolledCourseExecuteMock.mockImplementation((_ctx: TenantContext, courseId: string) =>
      Promise.resolve(
        courseId === 'course-1'
          ? enrolledCourseView('course-1', 'Intro a React', 40)
          : enrolledCourseView('course-2', 'TypeScript avanzado', 100),
      ),
    );
    const { LearnerHome } = await import('../../../src/app/dashboard/_components/learner-home');

    render(await LearnerHome({ ctx: studentCtx }));

    expect(screen.getByText('Intro a React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript avanzado')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no estás inscripto en ningún curso.')).not.toBeInTheDocument();
  });
});
