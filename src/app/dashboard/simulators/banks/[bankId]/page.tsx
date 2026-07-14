import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { UserMenu } from '../../../_components/user-menu';
import { DashboardNav } from '../../../_components/dashboard-nav';
import { requireInstructor } from '../../_lib/require-instructor';
import { BankHeader } from './_components/bank-header';
import { BankOverview } from './_components/bank-overview';
import { computeBankStats } from './_lib/bank-stats';
import { QuestionActionsToolbar } from './_components/question-actions-toolbar';
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
 * `courses/[courseId]/page.tsx`).
 *
 * Redesigned around the question list: `BankHeader` puts the bank's own
 * edit/delete behind low-noise corner icon buttons, `BankOverview` shows a
 * stat-tile summary computed via `computeBankStats` (plain
 * numbers/strings only — never the `Question` domain entity, see
 * `question-list.tsx`'s RSC-serialization doc comment), and
 * `QuestionActionsToolbar` hides the add/import forms behind two toggle
 * buttons so the question list stays the visual focus.
 */
export default async function BankDetailPage({ params }: BankDetailPageProps) {
  const { bankId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const composition = makeSimulatorComposition();
  const detail = await composition.getBankDetail.execute(ctx, bankId);
  if (!detail) notFound();

  const stats = computeBankStats(
    detail.questions.map((question) => ({ topic: question.topic, difficulty: question.difficulty })),
  );

  return (
    <AppShell navSlot={<DashboardNav ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <BankHeader
          bankId={detail.bank.id}
          title={detail.bank.title}
          description={detail.bank.description ?? ''}
        />
        <BankOverview total={stats.total} byDifficulty={stats.byDifficulty} byTopic={stats.byTopic} />
        <QuestionActionsToolbar bankId={detail.bank.id} />
        <QuestionList bankId={detail.bank.id} questions={detail.questions} />
      </div>
    </AppShell>
  );
}
