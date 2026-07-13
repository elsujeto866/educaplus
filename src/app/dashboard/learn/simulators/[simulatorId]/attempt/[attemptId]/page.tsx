import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../../../_components/user-menu';
import { toAttemptView } from './_lib/attempt-view';
import { AttemptRunner } from './_components/attempt-runner';

interface AttemptPageProps {
  params: Promise<{ simulatorId: string; attemptId: string }>;
}

/**
 * Timed exam page — Server Component. Reads `GetAttemptUseCase`, which
 * implements LAZY EXPIRY: an in_progress attempt read past its
 * `deadlineAt` is auto-transitioned to 'expired' and scored server-side
 * BEFORE this page ever renders (see `get-attempt.use-case.ts`). `null`
 * covers not-found, cross-tenant (RLS), AND cross-user (another
 * student's attempt) in one collapsed `notFound()` — never confirms
 * existence of a resource the caller should not see.
 *
 * `toAttemptView` (SECURITY-CRITICAL) strips `correctOptionId` before the
 * attempt ever crosses into the `'use client'` `AttemptRunner` boundary.
 */
export default async function AttemptPage({ params }: AttemptPageProps) {
  const { simulatorId, attemptId } = await params;
  const ctx = await getTenantContext();

  const composition = makeSimulatorComposition();
  const attempt = await composition.getAttempt.execute(ctx, attemptId);
  if (!attempt || attempt.simulatorId !== simulatorId) notFound();

  // Slice S6: the "Ver certificado" link must respect the bound simulator's
  // issuesCertificate toggle, not just `passed`. Defaults to `false`
  // (deny-by-default) on the defensive null case — a simulator this
  // attempt belongs to should always resolve, but hiding the link is the
  // safer failure mode if it somehow doesn't.
  const simulator = await composition.getSimulator.execute(ctx, simulatorId);
  const issuesCertificate = simulator?.issuesCertificate ?? false;

  return (
    <AppShell
      navSlot={
        <Link
          href={`/dashboard/learn/simulators/${simulatorId}`}
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          Volver al simulador
        </Link>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Simulador en curso" />
        <AttemptRunner attempt={toAttemptView(attempt)} issuesCertificate={issuesCertificate} />
      </div>
    </AppShell>
  );
}
