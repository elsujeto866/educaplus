import Link from 'next/link';
import type { TenantContext } from '@/shared/kernel/tenant-context';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { CourseCard } from '@/shared/ui/molecules/course-card';
import { UserMenu } from './user-menu';

interface LearnerHomeProps {
  ctx: TenantContext;
}

/**
 * Learner home — Server Component rendered for `ctx.role === 'student'`
 * from `dashboard/page.tsx`. Shows the student's own enrollments ("Mis
 * cursos", spec.md's "Student sees their enrollments" scenario) with
 * progress, plus a CTA into the full published-course catalog. Unlike the
 * instructor path, this never touches academy provisioning — students
 * don't need the local `academies` row lazy-ensure.
 *
 * `listMyEnrollments` returns bare `Enrollment` rows (no course/progress
 * data), so each enrollment is resolved via `getEnrolledCourse` to get the
 * title/description/progress needed for `CourseCard`. Enrollment counts
 * are expected to be small for an MVP student, so the N+1 read here is an
 * acceptable trade-off over introducing a new batch use-case.
 */
export async function LearnerHome({ ctx }: LearnerHomeProps) {
  const composition = makeCourseComposition();
  const enrollments = await composition.listMyEnrollments.execute(ctx);

  const enrolledCourses = (
    await Promise.all(
      enrollments.map((enrollment) => composition.getEnrolledCourse.execute(ctx, enrollment.courseId)),
    )
  ).filter((view): view is NonNullable<typeof view> => view !== null);

  return (
    <AppShell
      navSlot={
        <>
          <Link
            href="/dashboard/learn/courses"
            className="text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Catálogo
          </Link>
          <Link
            href="/dashboard/learn/simulators"
            className="text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Simuladores
          </Link>
        </>
      }
      userSlot={<UserMenu />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Mis cursos" subtitle="Seguí tu progreso y continuá aprendiendo." />
        {enrolledCourses.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <p>Todavía no estás inscripto en ningún curso.</p>
            <Link
              href="/dashboard/learn/courses"
              className="rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface"
            >
              Ver catálogo
            </Link>
          </Card>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {enrolledCourses.map((view) => (
                <li key={view.course.id}>
                  <CourseCard
                    title={view.course.title}
                    description={view.course.description ?? ''}
                    progressPercent={view.progressPercent}
                  >
                    <Link
                      href={`/dashboard/learn/courses/${view.course.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {view.progressPercent >= 100 ? 'Repasar' : 'Continuar'}
                    </Link>
                  </CourseCard>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/learn/courses"
              className="rounded-lg border border-border bg-surface-elevated px-4 py-3 text-center text-sm font-medium text-primary transition-colors hover:bg-surface"
            >
              Ver catálogo completo
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
