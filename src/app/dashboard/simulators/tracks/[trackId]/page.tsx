import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../../../_components/user-menu';
import { CoursesNavLink } from '../../../courses/_lib/courses-nav-link';
import { SimulatorsNavLink } from '../../_lib/simulators-nav-link';
import { TracksNavLink } from '../../_lib/tracks-nav-link';
import { requireInstructor } from '../../_lib/require-instructor';
import { TrackStepRow } from './_components/track-step-row';
import { AddTrackStepForm } from './_components/add-track-step-form';
import { TrackStatusActions } from './_components/track-status-actions';

interface TrackBuilderPageProps {
  params: Promise<{ trackId: string }>;
}

/**
 * Track builder — Server Component. Reads `GetTrackDetailUseCase` (track +
 * its ordered steps) through `makeSimulatorComposition()`. A nonexistent OR
 * foreign-academy `trackId` resolves to `null` under RLS, so this is also
 * the not-found path for cross-tenant access attempts (same convention as
 * `BankDetailPage`/`SimulatorEditPage`).
 *
 * The step list resolves each step's simulator title/status from
 * `ListSimulatorsUseCase`'s tenant-wide read (same join-in-delivery pattern
 * `SimulatorsPage` already uses for `bankTitleById`) — no new repository
 * method needed. The "add step" picker offers PUBLISHED simulators that are
 * NOT already a step of THIS track; a simulator already claimed by another
 * track still surfaces (the backend rejects it with a friendly
 * `SimulatorAlreadyInTrackError` message via `addTrackStepAction`, spec.md
 * "Reject duplicate simulator across tracks").
 */
export default async function TrackBuilderPage({ params }: TrackBuilderPageProps) {
  const { trackId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const composition = makeSimulatorComposition();
  const detail = await composition.getTrackDetail.execute(ctx, trackId);
  if (!detail) notFound();

  const [allSimulators, publishedSimulators] = await Promise.all([
    composition.listSimulators.execute(ctx),
    composition.listPublishedSimulators.execute(ctx),
  ]);
  const simulatorById = new Map(allSimulators.map((simulator) => [simulator.id, simulator]));

  const orderedSteps = [...detail.steps].sort((a, b) => a.position - b.position);
  const stepSimulatorIds = new Set(orderedSteps.map((step) => step.simulatorId));
  const availableSimulators = publishedSimulators
    .filter((simulator) => !stepSimulatorIds.has(simulator.id))
    .map((simulator) => ({ id: simulator.id, title: simulator.title }));

  return (
    <AppShell
      navSlot={
        <>
          <CoursesNavLink ctx={ctx} />
          <SimulatorsNavLink ctx={ctx} />
          <TracksNavLink ctx={ctx} />
        </>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title={detail.track.title}
          subtitle={detail.track.description ?? 'Ordená los pasos de esta pista.'}
        />

        <TrackStatusActions trackId={trackId} status={detail.track.status} />

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-foreground">Pasos</h2>
          {orderedSteps.length === 0 ? (
            <Card className="text-center text-sm text-muted-foreground">Esta pista todavía no tiene pasos</Card>
          ) : (
            <div className="flex flex-col gap-3">
              {orderedSteps.map((step, index) => {
                const simulator = simulatorById.get(step.simulatorId);
                return (
                  <TrackStepRow
                    key={step.id}
                    trackId={trackId}
                    stepId={step.id}
                    position={step.position}
                    simulatorTitle={simulator?.title ?? 'Simulacro desconocido'}
                    simulatorStatus={simulator?.status ?? 'draft'}
                    isFirst={index === 0}
                    isLast={index === orderedSteps.length - 1}
                  />
                );
              })}
            </div>
          )}
        </section>

        <AddTrackStepForm trackId={trackId} simulators={availableSimulators} />
      </div>
    </AppShell>
  );
}
