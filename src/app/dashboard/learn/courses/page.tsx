import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { CourseCard } from '@/shared/ui/molecules/course-card';
import { UserMenu } from '../../_components/user-menu';
import { EnrollButton } from '../_components/enroll-button';

/**
 * Published-course catalog — Server Component. Reads `listPublishedCourses`
 * through `makeCourseComposition()`. No role gate (spec.md "Learner routes
 * open to any role" — instructors/admins may preview too).
 */
export default async function LearnerCatalogPage() {
  const ctx = await getTenantContext();
  const courses = await makeCourseComposition().listPublishedCourses.execute(ctx);

  return (
    <AppShell userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title="Catálogo" subtitle="Cursos disponibles en tu academia." />
        {courses.length === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            No hay cursos disponibles todavía
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard title={course.title} description={course.description ?? ''}>
                  <EnrollButton courseId={course.id} />
                </CourseCard>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
