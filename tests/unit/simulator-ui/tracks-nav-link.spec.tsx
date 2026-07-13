/**
 * TracksNavLink unit tests — mirrors
 * `tests/unit/course-authoring-ui/courses-nav-link.spec.tsx`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';
import { TracksNavLink } from '../../../src/app/dashboard/simulators/_lib/tracks-nav-link';

function ctxWithRole(role: TenantContext['role']): TenantContext {
  return { orgId: 'org_A', userId: 'user_1', role };
}

describe('TracksNavLink', () => {
  it('renders a "Rutas de estudio" link pointing to /dashboard/simulators/tracks for an instructor', () => {
    render(<TracksNavLink ctx={ctxWithRole('instructor')} />);
    const link = screen.getByRole('link', { name: 'Rutas de estudio' });
    expect(link).toHaveAttribute('href', '/dashboard/simulators/tracks');
  });

  it('renders a "Rutas de estudio" link for an admin', () => {
    render(<TracksNavLink ctx={ctxWithRole('admin')} />);
    expect(screen.getByRole('link', { name: 'Rutas de estudio' })).toBeInTheDocument();
  });

  it('renders nothing for a student', () => {
    render(<TracksNavLink ctx={ctxWithRole('student')} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
