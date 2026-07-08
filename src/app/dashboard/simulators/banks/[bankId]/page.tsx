import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../_components/user-menu';
import { CoursesNavLink } from '../../../courses/_lib/courses-nav-link';
import { SimulatorsNavLink } from '../../_lib/simulators-nav-link';
import { TracksNavLink } from '../../_lib/tracks-nav-link';
import { requireInstructor } from '../../_lib/require-instructor';
import { BankEditForm } from './_components/bank-edit-form';
import { BankDeleteAction } from './_components/bank-delete-action';
import { QuestionFormCard } from './_components/question-form-card';
import { QuestionList } from './_components/question-list';

interface BankDetailPageProps {
  params: Promise<{ bankId: string }>;
}

/**
 * Bank detail — Server Component. Reads `GetBankDetailUseCase` through
 * `makeSimulatorComposition()` (single server round-trip). `bankId` comes
 * from a Promise per this Next.js version's async route params (AGENTS.md
 * breaking-change warning — confirmed empirically via
 * `courses/[courseId]/page.tsx`). A nonexistent OR foreign-academy bankId
 * resolves to `null` under RLS, so this is also the not-found path for
 * cross-tenant access attempts (same convention as
 * `courses/[courseId]/page.tsx`). Mirrors that route's structure: edit
 * form, delete action, then the question editor + list.
 */
export default async function BankDetailPage({ params }: BankDetailPageProps) {
  const { bankId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const composition = makeSimulatorComposition();
  const detail = await composition.getBankDetail.execute(ctx, bankId);
  if (!detail) notFound();

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
        <PageHeader title={detail.bank.title} subtitle="Editá el banco y sus preguntas." />
        <BankEditForm
          bankId={detail.bank.id}
          title={detail.bank.title}
          description={detail.bank.description ?? ''}
        />
        <BankDeleteAction bankId={detail.bank.id} />
        <QuestionList bankId={detail.bank.id} questions={detail.questions} />
        <QuestionFormCard bankId={detail.bank.id} mode="add" />
      </div>
    </AppShell>
  );
}
