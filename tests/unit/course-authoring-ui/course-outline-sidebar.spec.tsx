/**
 * CourseOutlineSidebar — pure presentational tree tests. Covers spec.md's
 * "Outline Rendering Order" and "Active Node Highlight" requirements plus
 * the href-less-lesson-as-label scenario (authoring pages have no lesson
 * editor route yet).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CourseOutlineSidebar,
  type CourseOutline,
} from '../../../src/shared/ui/organisms/course-outline-sidebar';

function buildOutline(overrides?: Partial<CourseOutline>): CourseOutline {
  return {
    courseId: 'course_1',
    courseTitle: 'React desde cero',
    courseHref: '/dashboard/learn/courses/course_1',
    modules: [
      {
        id: 'mod_1',
        title: 'Módulo 1',
        lessons: [
          {
            id: 'lesson_1',
            title: 'Introducción',
            type: 'video',
            href: '/dashboard/learn/courses/course_1/lessons/lesson_1',
          },
          {
            id: 'lesson_2',
            title: 'Instalación',
            type: 'text',
            href: '/dashboard/learn/courses/course_1/lessons/lesson_2',
          },
        ],
      },
      {
        id: 'mod_2',
        title: 'Módulo 2',
        lessons: [
          {
            id: 'lesson_3',
            title: 'Componentes',
            type: 'video',
            href: '/dashboard/learn/courses/course_1/lessons/lesson_3',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('CourseOutlineSidebar', () => {
  it('renders modules and lessons in the same order as the view-model', () => {
    render(<CourseOutlineSidebar outline={buildOutline()} />);

    const moduleHeadings = screen.getAllByText(/^Módulo \d$/).map((el) => el.textContent);
    expect(moduleHeadings).toEqual(['Módulo 1', 'Módulo 2']);

    const links = screen.getAllByRole('link').map((el) => el.textContent);
    expect(links).toEqual(['React desde cero', 'Introducción', 'Instalación', 'Componentes']);
  });

  it('renders without error and shows no module/lesson nodes for an empty outline', () => {
    render(<CourseOutlineSidebar outline={buildOutline({ modules: [] })} />);

    expect(screen.queryByText(/Módulo/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'React desde cero' })).toBeInTheDocument();
  });

  it('highlights only the node matching activeHref', () => {
    render(
      <CourseOutlineSidebar
        outline={buildOutline()}
        activeHref="/dashboard/learn/courses/course_1/lessons/lesson_2"
      />,
    );

    expect(screen.getByRole('link', { name: 'Instalación' })).toHaveClass('text-primary');
    expect(screen.getByRole('link', { name: 'Introducción' })).not.toHaveClass('text-primary');
    expect(screen.getByRole('link', { name: 'Componentes' })).not.toHaveClass('text-primary');
  });

  it('highlights nothing when activeHref matches no node in the outline', () => {
    render(
      <CourseOutlineSidebar
        outline={buildOutline()}
        activeHref="/dashboard/learn/courses/course_1/lessons/does-not-exist"
      />,
    );

    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveClass('text-primary');
    }
  });

  it('renders an href-less lesson as a plain label, not a link', () => {
    const outline = buildOutline({
      modules: [
        {
          id: 'mod_1',
          title: 'Módulo 1',
          lessons: [{ id: 'lesson_1', title: 'Sin publicar', type: 'text' }],
        },
      ],
    });

    render(<CourseOutlineSidebar outline={outline} />);

    expect(screen.queryByRole('link', { name: 'Sin publicar' })).not.toBeInTheDocument();
    expect(screen.getByText('Sin publicar')).toBeInTheDocument();
  });

  it('renders extraNodes as trailing links or labels, honoring activeHref', () => {
    const outline = buildOutline({
      extraNodes: [
        { id: 'quiz_1', label: 'Quiz final', href: '/dashboard/learn/courses/course_1/quiz', kind: 'quiz' },
        { id: 'cert_1', label: 'Certificado', kind: 'certificate' },
      ],
    });

    render(
      <CourseOutlineSidebar
        outline={outline}
        activeHref="/dashboard/learn/courses/course_1/quiz"
      />,
    );

    const quizLink = screen.getByRole('link', { name: 'Quiz final' });
    expect(quizLink).toHaveAttribute('href', '/dashboard/learn/courses/course_1/quiz');
    expect(quizLink).toHaveClass('text-primary');
    expect(screen.queryByRole('link', { name: 'Certificado' })).not.toBeInTheDocument();
    expect(screen.getByText('Certificado')).toBeInTheDocument();
  });
});
