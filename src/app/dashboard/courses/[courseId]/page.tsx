import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { CourseOutlineNav } from '@/shared/ui/organisms/course-outline-nav';
import { CourseWizardSteps } from '@/shared/ui/molecules/course-wizard-steps';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../_components/user-menu';
import { CoursesNavLink } from '../_lib/courses-nav-link';
import { requireInstructor } from '../_lib/require-instructor';
import { toCourseOutline } from '../_lib/course-outline';
import { computeCourseWizard } from './_lib/course-wizard';
import { CourseEditForm } from './_components/course-edit-form';
import { CourseStatusActions } from './_components/course-status-actions';
import { ModulesList } from './_components/modules-list';
import { AddModuleForm } from './_components/add-module-form';

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>;
}

/**
 * Course detail — Server Component. Reads `GetCourseDetailUseCase` through
 * `makeCourseComposition()` (single server round-trip, no client
 * data-fetching). `courseId` comes from a Promise per Next 16's async
 * route params. Decomposed into `_components/*` to avoid a mega-component:
 * edit form, status actions (publish/unpublish/delete), modules list
 * (up/down reorder), and the add-module form each own their slice.
 */
export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { courseId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const composition = makeCourseComposition();
  const detail = await composition.getCourseDetail.execute(ctx, courseId);
  if (!detail) notFound();

  const assessment = await composition.getAssessment.execute(ctx, courseId);
  const hasQuiz = (assessment?.questions.length ?? 0) >= 1;
  const wizard = computeCourseWizard(detail, hasQuiz);

  return (
    <AppShell
      navSlot={<CoursesNavLink ctx={ctx} />}
      userSlot={<UserMenu />}
      sidebar={<CourseOutlineNav outline={toCourseOutline(detail)} />}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader title={detail.course.title} subtitle="Editá el curso y organizá sus módulos." />
        <CourseWizardSteps steps={wizard.steps} />
        <CourseEditForm
          courseId={detail.course.id}
          title={detail.course.title}
          description={detail.course.description ?? ''}
        />
        <CourseStatusActions courseId={detail.course.id} status={detail.course.status} />
        <ModulesList courseId={detail.course.id} modules={detail.modules} />
        <AddModuleForm courseId={detail.course.id} />
      </div>
    </AppShell>
  );
}
