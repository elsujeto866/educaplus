import { notFound } from 'next/navigation';
import { makeAcademyComposition } from '@/modules/academy/composition';
import { Card } from '@/shared/ui/atoms/card';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { RequestAccessForm } from './_components/request-access-form';

interface PublicAcademyPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Public academy page — Server Component, UNTENANTED. Reads
 * `GetPublicAcademyUseCase` through `makeAcademyComposition()`; deliberately
 * never calls `getTenantContext()` (spec "Public-Safe Academy Projection",
 * design D1/D2 — the public path is DB-role-scoped, not app-only). `slug`
 * comes from a Promise per Next 16's async route params, matching the
 * existing `CourseDetailPage` convention.
 *
 * Unknown, unpublished, or soft-deleted slugs all resolve to `null` from the
 * use-case (RLS's `public_read` policy on `academies` is what actually
 * distinguishes them from a real academy) and render a 404 here (spec
 * "Unknown slug returns 404").
 */
export default async function PublicAcademyPage({ params }: PublicAcademyPageProps) {
  const { slug } = await params;
  const academy = await makeAcademyComposition().getPublicAcademy.execute(slug);
  if (!academy) notFound();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title={academy.name} subtitle="Solicitá acceso para unirte a esta academia." />
        <Card>
          <RequestAccessForm slug={academy.slug} />
        </Card>
      </div>
    </main>
  );
}
