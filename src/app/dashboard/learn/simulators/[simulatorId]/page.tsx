import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../../../_components/user-menu';
import { StartAttemptButton } from './_components/start-attempt-button';

interface SimulatorDetailPageProps {
  params: Promise<{ simulatorId: string }>;
}

/**
 * Simulator detail — Server Component. Reads
 * `GetPublishedSimulatorUseCase` (returns `null` for a nonexistent,
 * cross-tenant, OR still-draft simulator — spec.md "Unpublished stays
 * hidden" — so `notFound()` also covers the "student guesses a draft id"
 * case with zero content leak). Shows the simulator's RULES plus a
 * "Comenzar simulacro" CTA (Slice S4) — `StartAttemptButton` triggers
 * `startAttemptAction`, which enforces the attempt-limit SERVER-SIDE
 * (spec.md "Attempt limit exhausted") and either resumes an existing
 * in_progress attempt or freezes a new one, then redirects to the timed
 * exam page. Attempt history/remaining-count display remains deferred
 * (design Decision 9 lists it as a future enhancement, not required by
 * any spec scenario in this slice).
 */
export default async function SimulatorDetailPage({ params }: SimulatorDetailPageProps) {
  const { simulatorId } = await params;
  const ctx = await getTenantContext();
  const composition = makeSimulatorComposition();

  const simulator = await composition.getPublishedSimulator.execute(ctx, simulatorId);
  if (!simulator) notFound();

  // Phase 6 BYPASS FIX: also 404s any simulator that is a step of a
  // gamified track (`getTrackStepBySimulator`), regardless of that step's
  // lock status for this learner — same rationale as the catalog page. This
  // is the route that renders `StartAttemptButton` (bound to the shipped,
  // ungated `startAttemptAction`), so hiding it here closes the exploit
  // server-side: if this page 404s, that button — and its bound Server
  // Action reference — is never sent to the client at all.
  const trackStep = await composition.getTrackStepBySimulator.execute(ctx, simulatorId);
  if (trackStep) notFound();

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
        <StartAttemptButton simulatorId={simulator.id} />
      </div>
    </AppShell>
  );
}
