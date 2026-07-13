import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../../../_components/user-menu';

/**
 * Learner tracks catalog — Server Component. Reads `ListTracksUseCase`
 * through `makeSimulatorComposition()` (the SAME use-case the authoring
 * `TracksPage` uses — it is read-only and tenant-scoped, no `assertRole`
 * guard on it), then filters to `status === 'published'` here in delivery
 * (mirrors how `learn/simulators/page.tsx`'s standalone catalog already
 * filters via `ListPublishedSimulatorsUseCase`'s SQL-level filter — the
 * track equivalent stays additive-only rather than adding a new
 * `findPublishedByAcademy` on `SimulatorTrackRepository` for this one
 * read). No role gate — same "learner routes open to any role" convention
 * as `learn/courses/page.tsx`/`learn/simulators/page.tsx`.
 */
export default async function LearnerTracksCatalogPage() {
  const ctx = await getTenantContext();
  const tracks = await makeSimulatorComposition().listTracks.execute(ctx);
  const publishedTracks = tracks.filter((track) => track.status === 'published');

  return (
    <AppShell
      navSlot={
        <Link
          href="/dashboard/learn/simulators"
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          Simuladores
        </Link>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Pistas" subtitle="Rutas de simuladores con desbloqueo progresivo." />
        {publishedTracks.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            No hay pistas publicadas todavía
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {publishedTracks.map((track) => (
              <li key={track.id}>
                <Link
                  href={`/dashboard/learn/simulators/tracks/${track.id}`}
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
      </div>
    </AppShell>
  );
}
