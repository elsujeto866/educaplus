/**
 * ModuleRow behavioral tests — Server Component (no hooks), but has real
 * conditional logic worth testing: the module up/down buttons must be
 * disabled at the ordering boundaries, lessons render as links vs. an
 * empty state, each lesson also gets its own up/down reorder buttons
 * (disabled at ITS boundaries), and the AddLessonForm island is present.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/app/dashboard/courses/actions', () => ({
  reorderModuleUpAction: vi.fn(),
  reorderModuleDownAction: vi.fn(),
  reorderLessonUpAction: vi.fn(),
  reorderLessonDownAction: vi.fn(),
  addLessonAction: vi.fn(),
}));

describe('ModuleRow', () => {
  it('disables the "up" button when isFirst is true, keeps "down" enabled', async () => {
    const { ModuleRow } = await import('../../../src/app/dashboard/courses/[courseId]/_components/module-row');
    render(
      <ModuleRow
        courseId="course-1"
        moduleId="module-1"
        title="Introducción"
        lessons={[]}
        isFirst={true}
        isLast={false}
      />,
    );

    expect(screen.getByRole('button', { name: /hacia arriba/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /hacia abajo/i })).toBeEnabled();
  });

  it('disables the "down" button when isLast is true, keeps "up" enabled', async () => {
    const { ModuleRow } = await import('../../../src/app/dashboard/courses/[courseId]/_components/module-row');
    render(
      <ModuleRow
        courseId="course-1"
        moduleId="module-1"
        title="Cierre"
        lessons={[]}
        isFirst={false}
        isLast={true}
      />,
    );

    expect(screen.getByRole('button', { name: /hacia arriba/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /hacia abajo/i })).toBeDisabled();
  });

  it('renders each lesson as a link to its lesson editor route', async () => {
    const { ModuleRow } = await import('../../../src/app/dashboard/courses/[courseId]/_components/module-row');
    render(
      <ModuleRow
        courseId="course-1"
        moduleId="module-1"
        title="Introducción"
        lessons={[{ id: 'lesson-1', title: 'Bienvenida' }]}
        isFirst={false}
        isLast={false}
      />,
    );

    const link = screen.getByRole('link', { name: 'Bienvenida' });
    expect(link).toHaveAttribute('href', '/dashboard/courses/course-1/lessons/lesson-1');
  });

  it('shows an empty-state message when the module has no lessons', async () => {
    const { ModuleRow } = await import('../../../src/app/dashboard/courses/[courseId]/_components/module-row');
    render(
      <ModuleRow
        courseId="course-1"
        moduleId="module-1"
        title="Introducción"
        lessons={[]}
        isFirst={false}
        isLast={false}
      />,
    );

    expect(screen.getByText('Sin lecciones todavía.')).toBeInTheDocument();
  });

  it('disables each lesson\'s up/down reorder buttons at ITS OWN boundaries, independent of the module\'s', async () => {
    const { ModuleRow } = await import('../../../src/app/dashboard/courses/[courseId]/_components/module-row');
    render(
      <ModuleRow
        courseId="course-1"
        moduleId="module-1"
        title="Introducción"
        lessons={[
          { id: 'lesson-1', title: 'Primera' },
          { id: 'lesson-2', title: 'Segunda' },
        ]}
        isFirst={false}
        isLast={false}
      />,
    );

    const upButtons = screen.getAllByRole('button', { name: /mover lección .* hacia arriba/i });
    const downButtons = screen.getAllByRole('button', { name: /mover lección .* hacia abajo/i });

    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[0]).toBeEnabled();
    expect(upButtons[1]).toBeEnabled();
    expect(downButtons[1]).toBeDisabled();
  });

  it('renders the AddLessonForm island so instructors can add a lesson from the module row', async () => {
    const { ModuleRow } = await import('../../../src/app/dashboard/courses/[courseId]/_components/module-row');
    render(
      <ModuleRow
        courseId="course-1"
        moduleId="module-1"
        title="Introducción"
        lessons={[]}
        isFirst={false}
        isLast={false}
      />,
    );

    expect(screen.getByLabelText('Título de la lección')).toBeInTheDocument();
  });
});
