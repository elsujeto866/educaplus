import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { CoursesNavLink } from '../../../src/app/dashboard/courses/_lib/courses-nav-link';

function ctxWithRole(role: TenantContext['role']): TenantContext {
  return { orgId: 'org_A', userId: 'user_1', role };
}

describe('CoursesNavLink', () => {
  it('renders a "Cursos" link pointing to /dashboard/courses for an instructor', () => {
    render(<CoursesNavLink ctx={ctxWithRole('instructor')} />);
    const link = screen.getByRole('link', { name: 'Cursos' });
    expect(link).toHaveAttribute('href', '/dashboard/courses');
  });

  it('renders a "Cursos" link for an admin', () => {
    render(<CoursesNavLink ctx={ctxWithRole('admin')} />);
    expect(screen.getByRole('link', { name: 'Cursos' })).toBeInTheDocument();
  });

  it('renders nothing for a student', () => {
    render(<CoursesNavLink ctx={ctxWithRole('student')} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
