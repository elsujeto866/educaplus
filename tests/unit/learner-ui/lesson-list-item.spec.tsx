import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LessonListItem } from '../../../src/shared/ui/molecules/lesson-list-item';

describe('LessonListItem', () => {
  it('renders the lesson title', () => {
    render(<LessonListItem title="Introduccion" type="video" completed={false} />);
    expect(screen.getByText('Introduccion')).toBeInTheDocument();
  });

  it('shows a completed indicator when completed is true', () => {
    render(<LessonListItem title="Introduccion" type="video" completed />);
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
  });

  it('shows a pending indicator when completed is false', () => {
    render(<LessonListItem title="Introduccion" type="text" completed={false} />);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Completada')).not.toBeInTheDocument();
  });

  it('exposes the lesson type as accessible text (video)', () => {
    render(<LessonListItem title="Introduccion" type="video" completed={false} />);
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('exposes the lesson type as accessible text (text)', () => {
    render(<LessonListItem title="Lectura" type="text" completed={false} />);
    expect(screen.getByText('Texto')).toBeInTheDocument();
  });
});
