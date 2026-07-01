/**
 * Catalog page (`dashboard/learn/courses/page.tsx`) tests — spec.md's
 * "Published-only catalog" domain: renders published courses with an
 * enroll CTA per course, and an empty-state when there are none. No role
 * gate — any member (including instructor/admin preview) reaches this.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const listPublishedCoursesExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    listPublishedCourses: { execute: listPublishedCoursesExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

vi.mock('../../../src/app/dashboard/learn/_components/enroll-button', () => ({
  EnrollButton: ({ courseId }: { courseId: string }) => <button>Inscribirme-{courseId}</button>,
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

describe('Learner catalog page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    listPublishedCoursesExecuteMock.mockReset();
  });

  it('renders an empty-state message when there are no published courses', async () => {
    listPublishedCoursesExecuteMock.mockResolvedValue([]);
    const LearnerCatalogPage = (
      await import('../../../src/app/dashboard/learn/courses/page')
    ).default;

    render(await LearnerCatalogPage());

    expect(screen.getByText('No hay cursos disponibles todavía')).toBeInTheDocument();
  });

  it('renders one course card with an enroll button per published course', async () => {
    listPublishedCoursesExecuteMock.mockResolvedValue([
      { id: 'course-1', title: 'Intro a React', description: 'Bases del framework' },
      { id: 'course-2', title: 'TypeScript avanzado', description: null },
    ]);
    const LearnerCatalogPage = (
      await import('../../../src/app/dashboard/learn/courses/page')
    ).default;

    render(await LearnerCatalogPage());

    expect(screen.getByText('Intro a React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript avanzado')).toBeInTheDocument();
    expect(screen.getByText('Inscribirme-course-1')).toBeInTheDocument();
    expect(screen.getByText('Inscribirme-course-2')).toBeInTheDocument();
  });
});
