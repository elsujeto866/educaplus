/**
 * Admin courses list (`dashboard/courses/page.tsx`) tests — the list is the
 * entry point back into a course's authoring hub, so every course must be a
 * link to its `/dashboard/courses/[courseId]` detail page. Async Server
 * Component: rendered via `render(await CoursesPage())` with mocked context
 * and composition.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const listCoursesExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    listCourses: { execute: listCoursesExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

vi.mock('../../../src/app/dashboard/courses/_lib/courses-nav-link', () => ({
  CoursesNavLink: () => null,
}));

const instructorCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'instructor' };

async function renderCoursesPage() {
  const CoursesPage = (await import('../../../src/app/dashboard/courses/page')).default;
  render(await CoursesPage());
}

describe('Admin courses list page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(instructorCtx);
    listCoursesExecuteMock.mockReset();
  });

  it('renders an empty-state message when there are no courses', async () => {
    listCoursesExecuteMock.mockResolvedValue([]);
    await renderCoursesPage();
    expect(screen.getByText('Todavía no tenés cursos')).toBeInTheDocument();
  });

  it('renders each course as a link to its authoring detail page', async () => {
    listCoursesExecuteMock.mockResolvedValue([
      { id: 'course-1', title: 'Intro a React', status: 'draft' },
      { id: 'course-2', title: 'TypeScript avanzado', status: 'published' },
    ]);
    await renderCoursesPage();

    const first = screen.getByRole('link', { name: /Intro a React/ });
    expect(first).toHaveAttribute('href', '/dashboard/courses/course-1');

    const second = screen.getByRole('link', { name: /TypeScript avanzado/ });
    expect(second).toHaveAttribute('href', '/dashboard/courses/course-2');
  });

  it('shows the publication status alongside each course', async () => {
    listCoursesExecuteMock.mockResolvedValue([
      { id: 'course-1', title: 'Intro a React', status: 'draft' },
    ]);
    await renderCoursesPage();

    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });
});
