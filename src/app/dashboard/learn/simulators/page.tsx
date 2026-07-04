import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { CourseCard } from '@/shared/ui/molecules/course-card';
import { UserMenu } from '../../_components/user-menu';

/**
 * Published-simulator catalog — Server Component. Reads
 * `ListPublishedSimulatorsUseCase` through `makeSimulatorComposition()`.
 * No role gate (mirrors `learn/courses/page.tsx`'s "any role may browse"
 * rationale) — standalone catalog, no course enrollment required
 * (spec.md "Browse published simulators"). Reuses `CourseCard` — a plain
 * title/description/action-slot card with no course-specific fields.
 */
export default async function SimulatorCatalogPage() {
  const ctx = await getTenantContext();
  const simulators = await makeSimulatorComposition().listPublishedSimulators.execute(ctx);

  return (
    <AppShell userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Simulacros" subtitle="Simulacros disponibles en tu academia." />
        {simulators.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            No hay simulacros disponibles todavía
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {simulators.map((simulator) => (
              <li key={simulator.id}>
                <CourseCard title={simulator.title} description={simulator.description ?? ''}>
                  <Link
                    href={`/dashboard/learn/simulators/${simulator.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Ver detalle
                  </Link>
                </CourseCard>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
