/**
 * DashboardNav unit tests — the instructor/admin header nav. It now owns the
 * full item list (Inicio, Cursos, Simuladores, Rutas de estudio, Solicitudes)
 * and renders them through the client `DashboardNavLinks`, which marks the
 * item for the current route active via `getActiveHref` (longest-match-wins,
 * covered exhaustively in `nav-active-match.spec.ts`). These assertions prove
 * the role gating, the href wiring, and that exactly one item is marked
 * `aria-current="page"` — including the overlap case where being on a Rutas
 * page must NOT also light up Simuladores.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { DashboardNav } from '../../../src/app/dashboard/_components/dashboard-nav';

const mockPathname = vi.fn<() => string | null>(() => '/dashboard');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

function ctxWithRole(role: TenantContext['role']): TenantContext {
  return { orgId: 'org_A', userId: 'user_1', role };
}

beforeEach(() => {
  mockPathname.mockReturnValue('/dashboard');
});

describe('DashboardNav', () => {
  it('renders Inicio, Cursos, Simuladores, Rutas de estudio, and Solicitudes for an instructor', () => {
    render(<DashboardNav ctx={ctxWithRole('instructor')} />);

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Cursos' })).toHaveAttribute('href', '/dashboard/courses');
    expect(screen.getByRole('link', { name: 'Simuladores' })).toHaveAttribute(
      'href',
      '/dashboard/simulators',
    );
    expect(screen.getByRole('link', { name: 'Rutas de estudio' })).toHaveAttribute(
      'href',
      '/dashboard/simulators/tracks',
    );
    expect(screen.getByRole('link', { name: 'Solicitudes' })).toHaveAttribute(
      'href',
      '/dashboard/requests',
    );
  });

  it('renders the same five links for an admin', () => {
    render(<DashboardNav ctx={ctxWithRole('admin')} />);

    for (const name of ['Inicio', 'Cursos', 'Simuladores', 'Rutas de estudio', 'Solicitudes']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('renders none of the links for a student', () => {
    render(<DashboardNav ctx={ctxWithRole('student')} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('marks only Inicio active on the dashboard home', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<DashboardNav ctx={ctxWithRole('admin')} />);

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Cursos' })).not.toHaveAttribute('aria-current');
  });

  it('marks only Cursos active on a nested course route', () => {
    mockPathname.mockReturnValue('/dashboard/courses/123');
    render(<DashboardNav ctx={ctxWithRole('admin')} />);

    expect(screen.getByRole('link', { name: 'Cursos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('marks Rutas de estudio active — and NOT Simuladores — on a tracks route', () => {
    mockPathname.mockReturnValue('/dashboard/simulators/tracks/abc');
    render(<DashboardNav ctx={ctxWithRole('admin')} />);

    expect(screen.getByRole('link', { name: 'Rutas de estudio' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Simuladores' })).not.toHaveAttribute('aria-current');
  });
});
