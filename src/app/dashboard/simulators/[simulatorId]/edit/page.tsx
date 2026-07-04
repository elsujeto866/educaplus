import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../_components/user-menu';
import { CoursesNavLink } from '../../../courses/_lib/courses-nav-link';
import { SimulatorsNavLink } from '../../_lib/simulators-nav-link';
import { requireInstructor } from '../../_lib/require-instructor';
import { SimulatorEditForm } from './_components/simulator-edit-form';
import { SimulatorStatusActions } from './_components/simulator-status-actions';

interface SimulatorEditPageProps {
  params: Promise<{ simulatorId: string }>;
}

/**
 * Simulator rule builder — Server Component. Reads `GetSimulatorUseCase`
 * (regardless of publish status — this is the admin authoring view, not
 * the student catalog) plus `GetBankDetailUseCase` for the bound bank's
 * title and distinct topic list (topic-filter checkboxes need the same
 * source list used at creation time). A nonexistent OR foreign-academy
 * `simulatorId` resolves to `null` under RLS — same not-found/cross-tenant
 * convention as `BankDetailPage`/`CourseDetailPage`.
 */
export default async function SimulatorEditPage({ params }: SimulatorEditPageProps) {
  const { simulatorId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const composition = makeSimulatorComposition();
  const simulator = await composition.getSimulator.execute(ctx, simulatorId);
  if (!simulator) notFound();

  const bankDetail = await composition.getBankDetail.execute(ctx, simulator.bankId);
  const topics = Array.from(
    new Set(
      (bankDetail?.questions ?? [])
        .map((question) => question.topic)
        .filter((topic): topic is string => Boolean(topic)),
    ),
  ).sort();

  return (
    <AppShell
      navSlot={
        <>
          <CoursesNavLink ctx={ctx} />
          <SimulatorsNavLink ctx={ctx} />
        </>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title={simulator.title}
          subtitle={`Banco: ${bankDetail?.bank.title ?? 'desconocido'}`}
        />
        <SimulatorStatusActions simulatorId={simulator.id} status={simulator.status} />
        <SimulatorEditForm
          simulatorId={simulator.id}
          title={simulator.title}
          description={simulator.description ?? ''}
          questionCount={simulator.questionCount}
          passingScore={simulator.passingScore}
          timeLimitMinutes={simulator.timeLimitMinutes}
          attemptLimit={simulator.attemptLimit}
          topicFilter={simulator.topicFilter ?? []}
          topics={topics}
          issuesCertificate={simulator.issuesCertificate}
        />
      </div>
    </AppShell>
  );
}
