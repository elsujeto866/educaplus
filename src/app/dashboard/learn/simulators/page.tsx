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
 *
 * Phase 6 BYPASS FIX: excludes any simulator that is a step of a gamified
 * track (`getTrackStepBySimulator`). The shipped `startAttemptAction` has
 * NO track-lock check, so a track-step simulator reachable via this
 * standalone catalog could be started while its step is still locked for
 * the learner. Rather than editing `startAttemptAction`/`StartAttemptUseCase`
 * (forbidden — would require rewriting their shipped regression tests),
 * this hides ANY track-step simulator here, forcing learners through the
 * gated track level-map (`/dashboard/learn/simulators/tracks/[trackId]`)
 * instead — see `[simulatorId]/page.tsx` for the matching detail-route fix.
 */
export default async function SimulatorCatalogPage() {
  const ctx = await getTenantContext();
  const composition = makeSimulatorComposition();
  const allSimulators = await composition.listPublishedSimulators.execute(ctx);
  const trackSteps = await Promise.all(
    allSimulators.map((simulator) => composition.getTrackStepBySimulator.execute(ctx, simulator.id)),
  );
  const simulators = allSimulators.filter((_, index) => trackSteps[index] === null);

  return (
    <AppShell userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Simuladores" subtitle="Simuladores disponibles en tu academia." />
        {simulators.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            No hay simuladores disponibles todavía
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
