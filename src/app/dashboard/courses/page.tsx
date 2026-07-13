import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../_components/user-menu';
import { DashboardNav } from '../_components/dashboard-nav';
import { requireInstructor } from './_lib/require-instructor';

// Inline literal union instead of importing `PublicationStatus` from the
// domain layer — `src/app` is not allowed to depend on `domain` directly
// (eslint-boundaries: delivery → composition only, never domain/
// application/infrastructure). `Course.status` still type-checks against
// this record via structural typing.
const STATUS_LABEL: Record<'draft' | 'published', string> = {
  draft: 'Borrador',
  published: 'Publicado',
};

/**
 * Courses list — Server Component. Reads `ListCoursesUseCase` through
 * `makeCourseComposition()` (delivery may only reach `application` via
 * `composition`, never directly). Role-gated: only admin/instructor reach
 * this route, enforced by `requireInstructor` before any data read.
 */
export default async function CoursesPage() {
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const courses = await makeCourseComposition().listCourses.execute(ctx);

  return (
    <AppShell navSlot={<DashboardNav ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Cursos" subtitle="Gestioná los cursos de tu academia." />
        <Link
          href="/dashboard/courses/new"
          className="rounded-lg border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-primary transition-colors hover:bg-surface"
        >
          Crear curso
        </Link>
        {courses.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">Todavía no tenés cursos</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/dashboard/courses/${course.id}`}
                  className="block rounded-lg transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Card className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{course.title}</span>
                    <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
                      {STATUS_LABEL[course.status]}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
