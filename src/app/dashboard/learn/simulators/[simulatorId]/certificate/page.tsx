import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeSimulatorComposition } from '@/modules/simulator/composition';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../../_components/user-menu';
import { toSimulatorCertificateView } from './_lib/certificate-view-model';
import { SimulatorCertificateView } from './_components/certificate-view';
import { PrintButton } from './_components/print-button';

interface SimulatorCertificatePageProps {
  params: Promise<{ simulatorId: string }>;
}

/**
 * Resolves the academy display name shown on the certificate. Mirrors
 * `learn/courses/[courseId]/certificate/page.tsx`'s `resolveAcademyName`
 * verbatim: prefers the local `academies` table (RLS-scoped), falls back
 * to the Clerk organization's name for the rare webhook-provisioning race.
 */
async function resolveAcademyName(ctx: TenantContext): Promise<string> {
  const academy = await makeAcademyComposition().getAcademy.execute(ctx);
  if (academy) return academy.name;

  try {
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: ctx.orgId });
    return org.name;
  } catch {
    return 'Academia';
  }
}

/**
 * Simulator certificate viewer — Server Component. Mirrors the course
 * certificate route's RSC pattern (design Decision 8 / Slice S5), with two
 * deliberate differences:
 *
 *   1. No enrollment gate — simulators are standalone (spec.md's "Browse
 *      published simulators": "no course enrollment required"), so there is
 *      nothing analogous to check before resolving the simulator.
 *   2. `getSimulator` (NOT `getPublishedSimulator`) — a certificate proves a
 *      HISTORICAL pass; gating this route on the simulator's CURRENT
 *      publish status would hide an already-earned certificate the moment
 *      an admin unpublishes the simulator, which is not what "first pass
 *      wins, immutable" should mean for the LEARNER-facing view.
 *      `getSimulator.execute` still returns `null` for cross-tenant (RLS)
 *      and nonexistent ids, so `notFound()` never leaks anything.
 *
 * Lazily issues the certificate via `IssueSimulatorCertificateUseCase` on
 * first view (idempotent — passing twice never re-issues).
 * `SimulatorCertificateNotEarnedError` (matched by `Error.name` —
 * eslint-plugin-boundaries forbids `delivery` from importing `domain`
 * directly) is handled as a graceful redirect back to the simulator detail
 * page, never an unhandled crash.
 *
 * TOP SECURITY REQUIREMENT: the certificate `id` is generated HERE, via
 * `crypto.randomUUID()`, and is NEVER derived from `params`/request input —
 * the client/route can never control a certificate's id or code.
 */
export default async function SimulatorCertificatePage({ params }: SimulatorCertificatePageProps) {
  const { simulatorId } = await params;
  const ctx = await getTenantContext();
  const composition = makeSimulatorComposition();

  const simulator = await composition.getSimulator.execute(ctx, simulatorId);
  if (!simulator) notFound();

  const user = await currentUser();
  const studentName = user?.fullName?.trim() || user?.username || 'Estudiante';
  const academyName = await resolveAcademyName(ctx);

  // SERVER-generated — never sourced from params, query strings, or body.
  const id = crypto.randomUUID();

  let certificate;
  try {
    certificate = await composition.issueSimulatorCertificate.execute(ctx, {
      id,
      simulatorId,
      studentName,
      simulatorTitle: simulator.title,
      academyName,
      issuesCertificate: simulator.issuesCertificate,
    });
  } catch (error) {
    // Both are throw-based "skipped outcome" errors (Slice S6 adds the
    // config-gate to the existing pass-gate) — neither should ever crash
    // the page, both redirect back to the simulator detail view.
    if (
      error instanceof Error &&
      (error.name === 'SimulatorCertificateNotEarnedError' ||
        error.name === 'SimulatorCertificateNotConfiguredError')
    ) {
      redirect(`/dashboard/learn/simulators/${simulatorId}`);
    }
    throw error;
  }

  return (
    <AppShell
      navSlot={
        <Link
          href={`/dashboard/learn/simulators/${simulatorId}`}
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          {simulator.title}
        </Link>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 print:max-w-none">
        <PageHeader title="Tu certificado" subtitle={simulator.title} />
        <SimulatorCertificateView view={toSimulatorCertificateView(certificate)} />
        <PrintButton />
      </div>
    </AppShell>
  );
}
