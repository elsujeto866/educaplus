import Link from 'next/link';
import type { TenantContext } from '@/shared/kernel/tenant-context';

interface CoursesNavLinkProps {
  ctx: TenantContext;
}

/**
 * Role-gated "Cursos" nav link — rendered into `AppShell`'s `navSlot` by
 * any dashboard page that has resolved `TenantContext`. Hidden for
 * `student`, matching design.md §5 ("Dashboard nav 'Cursos' link rendered
 * only when ctx.role !== 'student'").
 */
export function CoursesNavLink({ ctx }: CoursesNavLinkProps) {
  if (ctx.role === 'student') return null;

  return (
    <Link href="/dashboard/courses" className="text-sm font-medium text-foreground transition-colors hover:text-primary">
      Cursos
    </Link>
  );
}
