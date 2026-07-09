import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import type { TrackStepStatus } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { CourseCard } from '@/shared/ui/molecules/course-card';
import type { BadgeProps } from '@/shared/ui/atoms/badge';
import { UserMenu } from '../../../../_components/user-menu';
import { StartTrackStepButton } from './_components/start-track-step-button';

interface LearnerTrackMapPageProps {
  params: Promise<{ trackId: string }>;
}

const STATUS_META: Record<TrackStepStatus, { label: string; variant: BadgeProps['variant'] }> = {
  locked: { label: 'Bloqueado', variant: 'default' },
  unlocked: { label: 'Disponible', variant: 'accent' },
  passed: { label: 'Completado', variant: 'success' },
};

/**
 * Learner gamified level-map — Server Component. Reads
 * `GetTrackForLearnerUseCase` through `makeSimulatorComposition()`, which
 * self-heals the learner's frontier lazily (design.md "Progression
 * triggered lazily on track-map view") BEFORE deriving each step's
 * locked/unlocked/passed status — so a newly-passed step is reflected the
 * moment this page is next viewed, with zero edit to `SubmitAttemptUseCase`.
 *
 * `SimulatorTrackNotFoundError` (nonexistent OR cross-tenant trackId) AND a
 * still-draft track both resolve to `notFound()` — mirrors
 * `GetPublishedSimulatorUseCase`'s "unpublished stays hidden" convention,
 * now applied to tracks.
 *
 * The `progressId` passed to `getTrackForLearner` is a SERVER-generated
 * UUID (`crypto.randomUUID()`, never derived from params/input) — used only
 * if this is the learner's very first reconciliation on this track (mirrors
 * the certificate page's server-generated `id` convention).
 *
 * Only the UNLOCKED step renders a "Comenzar" action
 * (`StartTrackStepButton`, bound to `startTrackStepAttemptAction`, which
 * delegates to the GUARDED `StartTrackStepAttemptUseCase` — never the raw
 * `startAttempt`). Locked steps render no interactive control at all — the
 * lock is also enforced server-side, this is defense-in-depth, not the
 * actual gate.
 */
export default async function LearnerTrackMapPage({ params }: LearnerTrackMapPageProps) {
  const { trackId } = await params;
  const ctx = await getTenantContext();
  const composition = makeSimulatorComposition();

  let view;
  try {
    view = await composition.getTrackForLearner.execute(ctx, {
      trackId,
      progressId: crypto.randomUUID(),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'SimulatorTrackNotFoundError') notFound();
    throw error;
  }
  if (view.track.status !== 'published') notFound();

  const simulators = await composition.listPublishedSimulators.execute(ctx);
  const simulatorById = new Map(simulators.map((simulator) => [simulator.id, simulator]));

  const orderedSteps = [...view.steps].sort((a, b) => a.position - b.position);

  return (
    <AppShell
      navSlot={
        <Link
          href="/dashboard/learn/simulators/tracks"
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          Pistas
        </Link>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title={view.track.title}
          subtitle={view.track.description ?? 'Superá cada paso para desbloquear el siguiente.'}
        />
        <ol className="flex flex-col gap-3">
          {orderedSteps.map((step) => {
            const simulator = simulatorById.get(step.simulatorId);
            const meta = STATUS_META[step.status];

            return (
              <li key={step.stepId}>
                <CourseCard
                  title={`${step.position}. ${simulator?.title ?? 'Simulacro'}`}
                  description={simulator?.description ?? ''}
                  status={{ label: meta.label, variant: meta.variant }}
                  {...(step.status === 'locked' ? { className: 'opacity-60' } : {})}
                >
                  {step.status === 'unlocked' ? (
                    <StartTrackStepButton simulatorId={step.simulatorId} />
                  ) : step.status === 'passed' ? (
                    <span className="text-sm text-muted-foreground">Ya superaste este paso</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Completá el paso anterior para desbloquear
                    </span>
                  )}
                </CourseCard>
              </li>
            );
          })}
        </ol>
      </div>
    </AppShell>
  );
}
