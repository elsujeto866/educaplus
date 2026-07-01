import { notFound } from 'next/navigation';
import { getTenantContext } from '@/shared/infrastructure/auth/clerk';
import { makeCourseComposition } from '@/modules/course/composition';
import { AppShell } from '@/shared/ui/organisms/app-shell';
import { PageHeader } from '@/shared/ui/molecules/page-header';
import { UserMenu } from '../../../../_components/user-menu';
import { CoursesNavLink } from '../../../_lib/courses-nav-link';
import { requireInstructor } from '../../../_lib/require-instructor';
import { LessonTextEditor } from './_components/lesson-text-editor';
import { LessonVideoEditor } from './_components/lesson-video-editor';
import { extractMarkdown } from './_lib/extract-markdown';

interface LessonEditorPageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

/**
 * Lesson editor — Server Component. Reads `GetLessonUseCase` through
 * `makeCourseComposition()`. Renders the type-specific editor: a markdown
 * textarea for text lessons (`LessonTextEditor`), or an external-URL input
 * for video lessons (`LessonVideoEditor`). `content.type` (not `lesson.type`)
 * is the narrowing discriminant — mirrors the `LessonContent` union.
 */
export default async function LessonEditorPage({ params }: LessonEditorPageProps) {
  const { courseId, lessonId } = await params;
  const ctx = await getTenantContext();
  requireInstructor(ctx);

  const lesson = await makeCourseComposition().getLesson.execute(ctx, lessonId);
  if (!lesson) notFound();

  return (
    <AppShell navSlot={<CoursesNavLink ctx={ctx} />} userSlot={<UserMenu />}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <PageHeader
          title={lesson.title}
          subtitle={lesson.content.type === 'video' ? 'Lección de video' : 'Lección de texto'}
        />
        {lesson.content.type === 'text' ? (
          <LessonTextEditor
            courseId={courseId}
            lessonId={lesson.id}
            initialValue={extractMarkdown(lesson.content.body)}
          />
        ) : (
          <LessonVideoEditor
            courseId={courseId}
            lessonId={lesson.id}
            initialUrl={lesson.content.externalUrl ?? ''}
          />
        )}
      </div>
    </AppShell>
  );
}
