import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { VideoEmbed } from '@/shared/ui/molecules/video-embed';
import { Markdown } from '@/shared/ui/molecules/markdown';
import { UserMenu } from '../../../../../_components/user-menu';
import { MarkCompleteButton } from '../../../../_components/mark-complete-button';
import { extractMarkdown } from './_lib/extract-markdown';

interface LessonViewerPageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

/**
 * Lesson viewer — Server Component. Access rule (spec.md's "Lesson
 * Viewer" domain): load `getEnrolledCourse` first — missing course →
 * `notFound()`; not enrolled → `redirect` to the course page (lesson
 * content is never fetched for a non-enrolled caller). The lesson's
 * `completed` flag and the tenant-scoped enrollment gate both come from
 * the same view-model, so an unknown `lessonId` (not part of this course)
 * also resolves to `notFound()` instead of leaking another course's
 * content. Full content (video URL / markdown body) comes from a second
 * read, `getLesson`, scoped by lessonId only.
 */
export default async function LessonViewerPage({ params }: LessonViewerPageProps) {
  const { courseId, lessonId } = await params;
  const ctx = await getTenantContext();
  const composition = makeCourseComposition();

  const view = await composition.getEnrolledCourse.execute(ctx, courseId);
  if (!view) notFound();
  if (!view.isEnrolled || !view.enrollmentId) {
    redirect(`/dashboard/learn/courses/${courseId}`);
  }

  const lessonView = view.modules
    .flatMap((mod) => mod.lessons)
    .find((l) => l.id === lessonId);
  if (!lessonView) notFound();

  const lesson = await composition.getLesson.execute(ctx, lessonId);
  if (!lesson) notFound();

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
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title={lesson.title}
          subtitle={lesson.content.type === 'video' ? 'Lección de video' : 'Lección de texto'}
        />
        {lesson.content.type === 'video' ? (
          <VideoEmbed url={lesson.content.externalUrl ?? ''} title={lesson.title} />
        ) : (
          <Markdown content={extractMarkdown(lesson.content.body)} />
        )}
        <MarkCompleteButton
          courseId={courseId}
          lessonId={lessonId}
          enrollmentId={view.enrollmentId}
          completed={lessonView.completed}
        />
      </div>
    </AppShell>
  );
}
