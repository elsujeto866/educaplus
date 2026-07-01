import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CourseCard } from '../../../src/shared/ui/molecules/course-card';

describe('CourseCard', () => {
  it('renders the course title', () => {
    render(<CourseCard title="Intro a React" />);
    expect(screen.getByText('Intro a React')).toBeInTheDocument();
  });

  it('renders the status badge label when status is provided', () => {
    render(<CourseCard title="Intro a React" status={{ label: 'Inscripto' }} />);
    expect(screen.getByText('Inscripto')).toBeInTheDocument();
  });

  it('does not render a status label when status is omitted', () => {
    render(<CourseCard title="Intro a React" />);
    expect(screen.queryByText('Inscripto')).not.toBeInTheDocument();
  });

  it('renders a progress bar reflecting progressPercent when provided', () => {
    render(<CourseCard title="Intro a React" progressPercent={70} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70');
  });

  it('renders the action slot children', () => {
    render(
      <CourseCard title="Intro a React">
        <a href="/dashboard/learn/courses/1">Continuar</a>
      </CourseCard>,
    );
    expect(screen.getByRole('link', { name: 'Continuar' })).toBeInTheDocument();
  });
});
