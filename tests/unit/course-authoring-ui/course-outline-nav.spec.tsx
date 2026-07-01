/**
 * CourseOutlineNav — thin `'use client'` shell tests. Covers spec.md's
 * "Mobile Overlay Drawer" and "Persistent Collapsible Pane" scenarios, plus
 * `usePathname()` driving the active node (mocked here since it's a Next.js
 * App Router hook with no meaning outside a router context).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUsePathname = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

import { CourseOutlineNav } from '../../../src/shared/ui/organisms/course-outline-nav';
import type { CourseOutline } from '../../../src/shared/ui/organisms/course-outline-sidebar';

const outline: CourseOutline = {
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
      ],
    },
  ],
};

describe('CourseOutlineNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue('/dashboard/learn/courses/course_1/lessons/lesson_1');
  });

  it('drives the active node from usePathname()', () => {
    render(<CourseOutlineNav outline={outline} />);

    expect(screen.getByRole('link', { name: 'Introducción' })).toHaveClass('text-primary');
  });

  it('toggles the md+ collapsed state reversibly', () => {
    render(<CourseOutlineNav outline={outline} />);

    fireEvent.click(screen.getByRole('button', { name: 'Contraer índice del curso' }));
    expect(screen.getByRole('button', { name: 'Expandir índice del curso' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir índice del curso' }));
    expect(screen.getByRole('button', { name: 'Contraer índice del curso' })).toBeInTheDocument();
  });

  it('opens the mobile drawer and closes it via the dismiss action', () => {
    render(<CourseOutlineNav outline={outline} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir índice del curso' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar índice del curso' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the mobile drawer on Escape', () => {
    render(<CourseOutlineNav outline={outline} />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir índice del curso' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
