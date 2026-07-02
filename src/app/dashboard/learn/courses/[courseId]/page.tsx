import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { CourseOutlineNav } from '@/shared/ui/organisms/course-outline-nav';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { Badge } from '@/shared/ui/atoms/badge';
import { ProgressBar } from '@/shared/ui/molecules/progress-bar';
import { LessonListItem } from '@/shared/ui/molecules/lesson-list-item';
import { UserMenu } from '../../../_components/user-menu';
import { EnrollButton } from '../../_components/enroll-button';
import { toCourseOutline } from '../../_lib/course-outline';

interface CourseViewerPageProps {
  params: Promise<{ courseId: string }>;
}

/**
 * Course viewer — Server Component. Reads `GetEnrolledCourseUseCase`
 * through `makeCourseComposition()`. The single view-model already
 * decides the enrollment gate (spec.md's "Course Viewer" domain):
 * not-enrolled visitors see course info + an "Inscribirme" CTA only —
 * lesson content/links are never rendered for them. Enrolled students see
 * modules/lessons in `position` order (already ordered by the use-case)
 * plus a `ProgressBar` and a "Curso completado" banner at 100%.
 */
export default async function CourseViewerPage({ params }: CourseViewerPageProps) {
  const { courseId } = await params;
  const ctx = await getTenantContext();
  const composition = makeCourseComposition();
  const view = await composition.getEnrolledCourse.execute(ctx, courseId);

  if (!view) notFound();

  const assessment = await composition.getAssessment.execute(ctx, courseId);
  const latestPassed = await composition.getLatestPassed.execute(ctx, courseId);
  const { course, modules, progressPercent, isEnrolled } = view;

  return (
    <AppShell
      navSlot={
        <Link
          href="/dashboard/learn/courses"
          className="text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          Catálogo
        </Link>
      }
      userSlot={<UserMenu />}
      sidebar={
        <CourseOutlineNav
          outline={toCourseOutline(view, {
            questionCount: assessment?.questions.length ?? 0,
            hasPassed: latestPassed !== null,
          })}
        />
      }
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title={course.title} subtitle={course.description ?? ''} />
        {!isEnrolled ? (
          <Card className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Inscribite para acceder a las lecciones de este curso.
            </p>
            <EnrollButton courseId={course.id} />
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <ProgressBar value={progressPercent} label="Progreso del curso" />
              {progressPercent >= 100 ? (
                <Badge variant="success" className="w-fit">
                  Curso completado
                </Badge>
              ) : null}
            </div>
            <ul className="flex flex-col gap-5">
              {modules.map((mod) => (
                <li key={mod.id} className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold text-foreground">{mod.title}</h2>
                  <ul className="flex flex-col gap-2">
                    {mod.lessons.map((lesson) => (
                      <li key={lesson.id}>
                        <Link
                          href={`/dashboard/learn/courses/${course.id}/lessons/${lesson.id}`}
                          className="block"
                        >
                          <LessonListItem
                            title={lesson.title}
                            type={lesson.type}
                            completed={lesson.completed}
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
