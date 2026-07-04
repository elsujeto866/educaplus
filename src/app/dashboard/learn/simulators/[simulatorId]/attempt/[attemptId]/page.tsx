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

  const attempt = await makeSimulatorComposition().getAttempt.execute(ctx, attemptId);
  if (!attempt || attempt.simulatorId !== simulatorId) notFound();

  return (
    <AppShell
      navSlot={
        <Link
          href={`/dashboard/learn/simulators/${simulatorId}`}
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          Volver al simulacro
        </Link>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Simulacro en curso" />
        <AttemptRunner attempt={toAttemptView(attempt)} />
      </div>
    </AppShell>
  );
}
