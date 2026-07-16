import type { TenantContext } from '@/shared/kernel/tenant-context';
import { DashboardNavLinks, type NavItem } from './dashboard-nav-links';

interface DashboardNavProps {
  ctx: TenantContext;
}

/**
 * Instructor/admin header nav. Owns the full item list and the role gate:
 * students never see this nav (they get the learner home's own nav), so the
 * whole fragment is hidden for `student` — matching the prior behavior where
 * every individual link self-gated to null. Item order is the visible order:
 * Inicio | Cursos | Simuladores | Rutas de estudio | Solicitudes. Active-state
 * highlighting is delegated to the client `DashboardNavLinks`; keeping the
 * list here (server) means the role decision never ships to the client.
 */
export function DashboardNav({ ctx }: DashboardNavProps) {
  if (ctx.role === 'student') return null;

  const items: NavItem[] = [
    { href: '/dashboard', label: 'Inicio' },
    { href: '/dashboard/courses', label: 'Cursos' },
    { href: '/dashboard/simulators', label: 'Simuladores' },
    { href: '/dashboard/simulators/tracks', label: 'Rutas de estudio' },
    { href: '/dashboard/requests', label: 'Solicitudes' },
  ];

  return <DashboardNavLinks items={items} />;
}
