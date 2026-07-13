import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../../../_components/user-menu';
import { DashboardNav } from '../../../../../_components/dashboard-nav';
import { requireInstructor } from '../../../../_lib/require-instructor';
import { CreateSimulatorForm } from './_components/create-simulator-form';

interface CreateSimulatorPageProps {
  params: Promise<{ bankId: string }>;
}

/**
 * Simulator CREATION — Server Component, bank-scoped (Decision 1: a
 * simulator binds to exactly one bank, so this route hangs off
 * `banks/[bankId]` rather than a generic bank picker). Reads
 * `GetBankDetailUseCase` to (a) confirm the bank exists/belongs to the
 * tenant — same not-found/cross-tenant convention as `BankDetailPage` —
 * and (b) derive the distinct topic list for the topic-filter checkboxes
 * from the bank's own questions.
 */
export default async function CreateSimulatorPage({ params }: CreateSimulatorPageProps) {
  const { bankId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const detail = await makeSimulatorComposition().getBankDetail.execute(ctx, bankId);
  if (!detail) notFound();

  const topics = Array.from(
    new Set(detail.questions.map((question) => question.topic).filter((topic): topic is string => Boolean(topic))),
  ).sort();

  return (
    <AppShell navSlot={<DashboardNav ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title="Crear simulador"
          subtitle={`Definí las reglas del simulador para el banco "${detail.bank.title}".`}
        />
        <CreateSimulatorForm bankId={bankId} topics={topics} />
      </div>
    </AppShell>
  );
}
