import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../../../_components/user-menu';

interface SimulatorDetailPageProps {
  params: Promise<{ simulatorId: string }>;
}

/**
 * Simulator detail — Server Component. Reads
 * `GetPublishedSimulatorUseCase` (returns `null` for a nonexistent,
 * cross-tenant, OR still-draft simulator — spec.md "Unpublished stays
 * hidden" — so `notFound()` also covers the "student guesses a draft id"
 * case with zero content leak). Shows the simulator's RULES only —
 * question count, time limit, passing score, attempt limit. The
 * start-attempt CTA and attempt history/remaining-count ship in Slice S4
 * (StartAttemptUseCase does not exist yet); this page is informational
 * only for now, matching this slice's scope.
 */
export default async function SimulatorDetailPage({ params }: SimulatorDetailPageProps) {
  const { simulatorId } = await params;
  const ctx = await getTenantContext();

  const simulator = await makeSimulatorComposition().getPublishedSimulator.execute(ctx, simulatorId);
  if (!simulator) notFound();

  return (
    <AppShell
      navSlot={
        <Link
          href="/dashboard/learn/simulators"
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          Simulacros
        </Link>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title={simulator.title} subtitle={simulator.description ?? ''} />
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cantidad de preguntas</span>
            <span className="font-medium text-foreground">{simulator.questionCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Límite de tiempo</span>
            <span className="font-medium text-foreground">{simulator.timeLimitMinutes} min</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Puntaje para aprobar</span>
            <span className="font-medium text-foreground">{simulator.passingScore}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Intentos permitidos</span>
            <span className="font-medium text-foreground">{simulator.attemptLimit}</span>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
