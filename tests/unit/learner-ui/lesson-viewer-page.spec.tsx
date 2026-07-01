/**
 * Lesson viewer page (`.../[courseId]/lessons/[lessonId]/page.tsx`) tests
 * — spec.md's "Lesson Viewer" domain: enrollment gates lesson content
 * (redirect to the course page if not enrolled), content renders by
 * `content.type` (VideoEmbed takes the RAW url per Slice 2A's deviation —
 * it converts internally), and a mark-complete control is shown bound to
 * courseId/lessonId/enrollmentId with the current completed state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TenantContext } from '../../../src/shared/kernel/tenant-context';

const getTenantContextMock = vi.fn();
vi.mock('../../../src/shared/infrastructure/auth/clerk', () => ({
  getTenantContext: () => getTenantContextMock(),
}));

const getEnrolledCourseExecuteMock = vi.fn();
const getLessonExecuteMock = vi.fn();
vi.mock('../../../src/modules/course/composition', () => ({
  makeCourseComposition: () => ({
    getEnrolledCourse: { execute: getEnrolledCourseExecuteMock },
    getLesson: { execute: getLessonExecuteMock },
  }),
}));

vi.mock('../../../src/app/dashboard/_components/user-menu', () => ({
  UserMenu: () => null,
}));

vi.mock('../../../src/shared/ui/molecules/video-embed', () => ({
  VideoEmbed: ({ url, title }: { url: string; title: string }) => (
    <div data-testid="video-embed" data-url={url} data-title={title} />
  ),
}));

vi.mock('../../../src/shared/ui/molecules/markdown', () => ({
  Markdown: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

vi.mock('../../../src/app/dashboard/learn/_components/mark-complete-button', () => ({
  MarkCompleteButton: ({
    courseId,
    lessonId,
    enrollmentId,
    completed,
  }: {
    courseId: string;
    lessonId: string;
    enrollmentId: string;
    completed: boolean;
  }) => (
    <div data-testid="mark-complete-button">
      {courseId}-{lessonId}-{enrollmentId}-{String(completed)}
    </div>
  ),
}));

class FakeRedirectSignal extends Error {}
const redirectMock = vi.fn((_path: string) => {
  throw new FakeRedirectSignal('NEXT_REDIRECT');
});
class FakeNotFoundSignal extends Error {}
const notFoundMock = vi.fn(() => {
  throw new FakeNotFoundSignal('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  notFound: () => notFoundMock(),
}));

const studentCtx: TenantContext = { orgId: 'org_A', userId: 'user_1', role: 'student' };

function enrolledView(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    course: { id: 'course-1', title: 'Intro a React' },
    modules: [
      {
        id: 'module-1',
        title: 'Módulo 1',
        description: null,
        position: 0,
        lessons: [
          { id: 'lesson-1', title: 'Lección de video', type: 'video', position: 0, completed: false },
          { id: 'lesson-2', title: 'Lección de texto', type: 'text', position: 1, completed: true },
        ],
      },
    ],
    progressPercent: 50,
    isEnrolled: true,
    enrollmentId: 'enrollment-1',
    ...overrides,
  };
}

const params = (lessonId: string) =>
  Promise.resolve({ courseId: 'course-1', lessonId });

describe('Lesson viewer page', () => {
  beforeEach(() => {
    getTenantContextMock.mockReset().mockResolvedValue(studentCtx);
    getEnrolledCourseExecuteMock.mockReset();
    getLessonExecuteMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
  });

  it('redirects to the course page when the caller is not enrolled', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView({ isEnrolled: false, enrollmentId: null }));
    const LessonViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/lessons/[lessonId]/page')
    ).default;

    await expect(
      LessonViewerPage({ params: params('lesson-1') }),
    ).rejects.toThrow(FakeRedirectSignal);
    expect(redirectMock).toHaveBeenCalledWith('/dashboard/learn/courses/course-1');
    expect(getLessonExecuteMock).not.toHaveBeenCalled();
  });

  it('calls notFound() when the course does not exist', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(null);
    const LessonViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/lessons/[lessonId]/page')
    ).default;

    await expect(
      LessonViewerPage({ params: params('lesson-1') }),
    ).rejects.toThrow(FakeNotFoundSignal);
  });

  it('calls notFound() when the lesson does not belong to the course', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    const LessonViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/lessons/[lessonId]/page')
    ).default;

    await expect(
      LessonViewerPage({ params: params('lesson-unknown') }),
    ).rejects.toThrow(FakeNotFoundSignal);
  });

  it('renders VideoEmbed with the raw external url for a video lesson', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    getLessonExecuteMock.mockResolvedValue({
      id: 'lesson-1',
      title: 'Lección de video',
      type: 'video',
      content: { type: 'video', externalUrl: 'https://youtu.be/abc123', cloudflareUid: null, durationSeconds: null, thumbnailUrl: null },
    });
    const LessonViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/lessons/[lessonId]/page')
    ).default;

    render(await LessonViewerPage({ params: params('lesson-1') }));

    const embed = screen.getByTestId('video-embed');
    expect(embed).toHaveAttribute('data-url', 'https://youtu.be/abc123');
    expect(embed).toHaveAttribute('data-title', 'Lección de video');
    expect(screen.getByTestId('mark-complete-button')).toHaveTextContent(
      'course-1-lesson-1-enrollment-1-false',
    );
  });

  it('renders Markdown with the extracted value for a text lesson', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    getLessonExecuteMock.mockResolvedValue({
      id: 'lesson-2',
      title: 'Lección de texto',
      type: 'text',
      content: { type: 'text', body: { format: 'markdown', value: '# Hola' } },
    });
    const LessonViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/lessons/[lessonId]/page')
    ).default;

    render(await LessonViewerPage({ params: params('lesson-2') }));

    expect(screen.getByTestId('markdown')).toHaveTextContent('# Hola');
    expect(screen.getByTestId('mark-complete-button')).toHaveTextContent(
      'course-1-lesson-2-enrollment-1-true',
    );
  });

  it('links back to the course viewer', async () => {
    getEnrolledCourseExecuteMock.mockResolvedValue(enrolledView());
    getLessonExecuteMock.mockResolvedValue({
      id: 'lesson-2',
      title: 'Lección de texto',
      type: 'text',
      content: { type: 'text', body: { format: 'markdown', value: '# Hola' } },
    });
    const LessonViewerPage = (
      await import('../../../src/app/dashboard/learn/courses/[courseId]/lessons/[lessonId]/page')
    ).default;

    render(await LessonViewerPage({ params: params('lesson-2') }));

    expect(screen.getByRole('link', { name: /Intro a React/ })).toHaveAttribute(
      'href',
      '/dashboard/learn/courses/course-1',
    );
  });
});
