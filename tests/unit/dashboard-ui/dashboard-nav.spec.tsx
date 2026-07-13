/**
 * DashboardNav unit tests — the shared authoring nav composed of
 * `CoursesNavLink` + `SimulatorsNavLink` + `TracksNavLink`. Exists so every
 * authoring page (`courses/**`, `simulators/**`) renders the SAME nav
 * fragment instead of hand-assembling it, which is what caused the
 * "Simuladores/Pistas links disappear on Cursos pages" bug (courses pages
 * only rendered `CoursesNavLink`). Each underlying link already role-gates
 * itself for `student` — this component just composes them, so the
 * assertions here only need to prove composition, not re-test each link's
 * own role logic (covered by their own spec files).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { DashboardNav } from '../../../src/app/dashboard/_components/dashboard-nav';

function ctxWithRole(role: TenantContext['role']): TenantContext {
  return { orgId: 'org_A', userId: 'user_1', role };
}

describe('DashboardNav', () => {
  it('renders Cursos, Simuladores, and Rutas de estudio links for an instructor', () => {
    render(<DashboardNav ctx={ctxWithRole('instructor')} />);

    expect(screen.getByRole('link', { name: 'Cursos' })).toHaveAttribute(
      'href',
      '/dashboard/courses',
    );
    expect(screen.getByRole('link', { name: 'Simuladores' })).toHaveAttribute(
      'href',
      '/dashboard/simulators',
    );
    expect(screen.getByRole('link', { name: 'Rutas de estudio' })).toHaveAttribute(
      'href',
      '/dashboard/simulators/tracks',
    );
  });

  it('renders Cursos, Simuladores, and Rutas de estudio links for an admin', () => {
    render(<DashboardNav ctx={ctxWithRole('admin')} />);

    expect(screen.getByRole('link', { name: 'Cursos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Simuladores' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rutas de estudio' })).toBeInTheDocument();
  });

  it('renders none of the links for a student', () => {
    render(<DashboardNav ctx={ctxWithRole('student')} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
