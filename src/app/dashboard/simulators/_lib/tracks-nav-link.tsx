import Link from 'next/link';
import type { TenantContext } from '@/shared/kernel/tenant-context';

interface TracksNavLinkProps {
  ctx: TenantContext;
}

/**
 * Role-gated "Pistas" nav link — rendered into `AppShell`'s `navSlot`
 * alongside `CoursesNavLink`/`SimulatorsNavLink`. Hidden for `student`
 * (track authoring is an admin/instructor concern; the student-facing
 * gamified level-map ships in Phase 6). Mirrors `simulators-nav-link.tsx`.
 */
export function TracksNavLink({ ctx }: TracksNavLinkProps) {
  if (ctx.role === 'student') return null;

  return (
    <Link
      href="/dashboard/simulators/tracks"
      className="text-sm font-medium text-foreground transition-colors hover:text-primary"
    >
      Rutas de estudio
    </Link>
  );
}
