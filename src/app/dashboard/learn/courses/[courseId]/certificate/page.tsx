import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { CourseOutlineNav } from '@/shared/ui/organisms/course-outline-nav';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../../_components/user-menu';
import { toCourseOutline } from '../../../_lib/course-outline';
import { toCertificateView } from './_lib/certificate-view-model';
import { CertificateView } from './_components/certificate-view';
import { PrintButton } from './_components/print-button';

interface CertificatePageProps {
  params: Promise<{ courseId: string }>;
}

/**
 * Resolves the academy display name shown on the certificate. Prefers the
 * local `academies` table (canonical, RLS-scoped — the same source the
 * dashboard uses); falls back to the Clerk organization's name for the
 * rare webhook-provisioning race where the local row does not exist yet
 * (design.md's "academyName" decision).
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
 * Certificate viewer — Server Component. Mirrors the quiz route's RSC gate
 * pattern exactly (missing course -> `notFound()`; not enrolled ->
 * `redirect` to the course page), then lazily issues the certificate via
 * `IssueCertificateUseCase` on first view (spec.md's "Issuance on View
 * (Idempotent)"). `CertificateNotEarnedError` (matched by `Error.name` —
 * eslint-plugin-boundaries forbids `delivery` from importing `domain`
 * directly, mirroring `action-result.ts`'s established convention) is
 * handled as a graceful redirect back to the quiz, never an unhandled
 * crash (spec.md's "Pass Gate").
 *
 * TOP SECURITY REQUIREMENT: the certificate `id` is generated HERE, via
 * `crypto.randomUUID()`, and is NEVER derived from `params`/request input
 * — the client/route can never control a certificate's id or code.
 */
export default async function CertificatePage({ params }: CertificatePageProps) {
  const { courseId } = await params;
  const ctx = await getTenantContext();
  const composition = makeCourseComposition();

  const view = await composition.getEnrolledCourse.execute(ctx, courseId);
  if (!view) notFound();
  if (!view.isEnrolled) {
    redirect(`/dashboard/learn/courses/${courseId}`);
  }

  const user = await currentUser();
  const studentName = user?.fullName?.trim() || user?.username || 'Estudiante';
  const academyName = await resolveAcademyName(ctx);

  // SERVER-generated — never sourced from params, query strings, or body.
  const id = crypto.randomUUID();

  let certificate;
  try {
    certificate = await composition.issueCertificate.execute(ctx, {
      id,
      courseId,
      studentName,
      courseTitle: view.course.title,
      academyName,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CertificateNotEarnedError') {
      redirect(`/dashboard/learn/courses/${courseId}/quiz`);
    }
    throw error;
  }

  const assessment = await composition.getAssessment.execute(ctx, courseId);

  return (
    <AppShell
      navSlot={
        <Link
          href={`/dashboard/learn/courses/${courseId}`}
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          {view.course.title}
        </Link>
      }
      userSlot={<UserMenu />}
      sidebar={
        <CourseOutlineNav
          outline={toCourseOutline(view, {
            questionCount: assessment?.questions.length ?? 0,
            hasPassed: true,
          })}
        />
      }
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 print:max-w-none">
        <PageHeader title="Tu certificado" subtitle={view.course.title} />
        <CertificateView view={toCertificateView(certificate)} />
        <PrintButton />
      </div>
    </AppShell>
  );
}
