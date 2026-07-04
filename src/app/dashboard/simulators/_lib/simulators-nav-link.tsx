import Link from 'next/link';
import type { TenantContext } from '@/shared/kernel/tenant-context';

interface SimulatorsNavLinkProps {
  ctx: TenantContext;
}

/**
 * Role-gated "Simulacros" nav link — rendered into `AppShell`'s `navSlot`
 * alongside `CoursesNavLink`. Hidden for `student` (bank authoring is an
 * admin/instructor concern; the student-facing catalog ships in Slice S3).
 * Mirrors `courses/_lib/courses-nav-link.tsx`.
 */
export function SimulatorsNavLink({ ctx }: SimulatorsNavLinkProps) {
  if (ctx.role === 'student') return null;

  return (
    <Link
      href="/dashboard/simulators"
      className="text-sm font-medium text-foreground transition-colors hover:text-primary"
    >
      Simulacros
    </Link>
  );
}
