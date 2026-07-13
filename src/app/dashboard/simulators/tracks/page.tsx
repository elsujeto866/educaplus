import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../../_components/user-menu';
import { DashboardNav } from '../../_components/dashboard-nav';
import { requireInstructor } from '../_lib/require-instructor';

/**
 * Tracks home — Server Component. Reads `ListTracksUseCase` through
 * `makeSimulatorComposition()` (delivery may only reach `application` via
 * `composition`, never directly). Role-gated: only admin/instructor reach
 * this route. Mirrors `simulators/page.tsx`'s bank-list section.
 */
export default async function TracksPage() {
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const tracks = await makeSimulatorComposition().listTracks.execute(ctx);

  return (
    <AppShell navSlot={<DashboardNav ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title="Pistas gamificadas"
          subtitle="Encadená simuladores publicados en una ruta con desbloqueo progresivo."
        />

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Pistas</h2>
            <Link
              href="/dashboard/simulators/tracks/new"
              className="text-sm font-medium text-primary hover:underline"
            >
              Crear pista
            </Link>
          </div>
          {tracks.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">Todavía no tenés pistas</Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {tracks.map((track) => (
                <li key={track.id}>
                  <Link
                    href={`/dashboard/simulators/tracks/${track.id}`}
                    className="block rounded-lg transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Card className="flex flex-col gap-2">
                      <span className="font-medium text-foreground">{track.title}</span>
                      {track.description ? (
                        <p className="text-sm text-muted-foreground">{track.description}</p>
                      ) : null}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
