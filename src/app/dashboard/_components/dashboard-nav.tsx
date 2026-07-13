import type { TenantContext } from '@/shared/kernel/tenant-context';
import { CoursesNavLink } from '../courses/_lib/courses-nav-link';
import { SimulatorsNavLink } from '../simulators/_lib/simulators-nav-link';
import { TracksNavLink } from '../simulators/_lib/tracks-nav-link';

interface DashboardNavProps {
  ctx: TenantContext;
}

/**
 * Shared authoring nav — composes `CoursesNavLink` + `SimulatorsNavLink` +
 * `TracksNavLink` so every authoring page (`courses/**`, `simulators/**`)
 * renders the SAME nav fragment instead of hand-assembling it inline.
 * Fixes the bug where `courses/**` pages only rendered `CoursesNavLink`,
 * dropping the Simuladores/Pistas links whenever a learner-turned-instructor
 * navigated into Cursos. Each underlying link already role-gates itself for
 * `student` (returns `null`); this component performs no role logic of its
 * own — it is pure composition.
 */
export function DashboardNav({ ctx }: DashboardNavProps) {
  return (
    <>
      <CoursesNavLink ctx={ctx} />
      <SimulatorsNavLink ctx={ctx} />
      <TracksNavLink ctx={ctx} />
    </>
  );
}
