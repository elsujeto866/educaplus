import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../_components/user-menu';
import { CoursesNavLink } from '../../_lib/courses-nav-link';
import { requireInstructor } from '../../_lib/require-instructor';
import { fromAssessmentView } from './_lib/quiz-form';
import { QuizBuilderForm } from './_components/quiz-builder-form';

interface QuizBuilderPageProps {
  params: Promise<{ courseId: string }>;
}

/**
 * Quiz builder — Server Component. Reads `GetAssessmentUseCase` through
 * `makeCourseComposition()` to prefill the builder (or render an empty
 * draft when the course has no quiz yet). `courseId` comes from a Promise
 * per Next 16's async route params. Mirrors the lesson-editor route: no
 * outline sidebar, just the authoring form. Guards on course existence via
 * the tenant-scoped `GetCourseDetailUseCase`, same as the sibling
 * `[courseId]/page.tsx` and `lessons/[lessonId]/page.tsx` routes — a
 * nonexistent OR foreign-academy courseId resolves to `null` under RLS,
 * so this is also the not-found path for cross-tenant access attempts.
 */
export default async function QuizBuilderPage({ params }: QuizBuilderPageProps) {
  const { courseId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const composition = makeCourseComposition();
  const detail = await composition.getCourseDetail.execute(ctx, courseId);
  if (!detail) notFound();

  const assessment = await composition.getAssessment.execute(ctx, courseId);

  return (
    <AppShell navSlot={<CoursesNavLink ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title="Evaluación final"
          subtitle="Armá el cuestionario de opción múltiple del curso."
        />
        <QuizBuilderForm
          courseId={courseId}
          initialTitle={assessment?.title ?? ''}
          initialQuestions={fromAssessmentView(assessment)}
        />
      </div>
    </AppShell>
  );
}
