import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { CourseOutlineNav } from '@/shared/ui/organisms/course-outline-nav';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { Card } from '@/shared/ui/atoms/card';
import { UserMenu } from '../../../../_components/user-menu';
import { toCourseOutline } from '../../../_lib/course-outline';
import { toQuizView } from './_lib/quiz-view';
import { QuizRunner } from './_components/quiz-runner';

interface QuizPageProps {
  params: Promise<{ courseId: string }>;
}

/**
 * Final-quiz viewer — Server Component. Access rule mirrors the lesson
 * route exactly (spec.md's "Enrollment and Empty-Quiz Access Gate"):
 * missing course -> `notFound()`; not enrolled -> `redirect` to the
 * course page (quiz content is never fetched for a non-enrolled caller).
 * A quiz with zero questions renders an empty-state card instead of the
 * runner (spec.md's "Empty quiz has no entry point"). `toQuizView` strips
 * `correctOptionId` before the assessment ever reaches the `'use client'`
 * `QuizRunner` boundary — see `_lib/quiz-view.ts`.
 */
export default async function QuizPage({ params }: QuizPageProps) {
  const { courseId } = await params;
  const ctx = await getTenantContext();
  const composition = makeCourseComposition();

  const view = await composition.getEnrolledCourse.execute(ctx, courseId);
  if (!view) notFound();
  if (!view.isEnrolled) {
    redirect(`/dashboard/learn/courses/${courseId}`);
  }

  const assessment = await composition.getAssessment.execute(ctx, courseId);
  const questionCount = assessment?.questions.length ?? 0;
  const latestPassed = await composition.getLatestPassed.execute(ctx, courseId);

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
      sidebar={<CourseOutlineNav outline={toCourseOutline(view, { questionCount })} />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title="Evaluación final"
          subtitle={assessment?.title ?? ''}
        />
        {!assessment || questionCount === 0 ? (
          <Card className="text-center text-sm text-muted-foreground">
            La evaluación todavía no está disponible.
          </Card>
        ) : (
          <QuizRunner
            courseId={courseId}
            quiz={toQuizView(assessment)}
            latest={
              latestPassed ? { score: latestPassed.score, passed: latestPassed.passed } : null
            }
          />
        )}
      </div>
    </AppShell>
  );
}
