/**
 * QuizResult — presentational result view (spec.md's "Attempt Submission
 * and Result Display" + "Result Non-Disclosure"). Shows only the score
 * and a PASSED/FAILED indicator — never per-question correctness or the
 * correct option — and a retake control.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizResult } from '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_components/quiz-result';

describe('QuizResult', () => {
  it('shows the score and a PASSED badge when passed is true', () => {
    render(<QuizResult score={80} passed onRetake={() => {}} />);

    expect(screen.getByText('80 / 100')).toBeInTheDocument();
    expect(screen.getByText(/aprobado/i)).toBeInTheDocument();
  });

  it('shows a FAILED badge when passed is false', () => {
    render(<QuizResult score={40} passed={false} onRetake={() => {}} />);

    expect(screen.getByText('40 / 100')).toBeInTheDocument();
    expect(screen.getByText(/desaprobado/i)).toBeInTheDocument();
  });

  it('fires onRetake when the retake button is clicked', () => {
    const onRetake = vi.fn();
    render(<QuizResult score={40} passed={false} onRetake={onRetake} />);

    fireEvent.click(screen.getByRole('button', { name: /volver a intentar/i }));

    expect(onRetake).toHaveBeenCalledOnce();
  });

  it('shows a "Ver certificado" link when passed and certificateHref is provided', () => {
    render(
      <QuizResult
        score={90}
        passed
        onRetake={() => {}}
        certificateHref="/dashboard/learn/courses/course-1/certificate"
      />,
    );

    const link = screen.getByRole('link', { name: /ver certificado/i });
    expect(link).toHaveAttribute('href', '/dashboard/learn/courses/course-1/certificate');
  });

  it('hides the "Ver certificado" link when not passed, even with certificateHref provided', () => {
    render(
      <QuizResult
        score={40}
        passed={false}
        onRetake={() => {}}
        certificateHref="/dashboard/learn/courses/course-1/certificate"
      />,
    );

    expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
  });

  it('hides the "Ver certificado" link when passed but certificateHref is not provided', () => {
    render(<QuizResult score={90} passed onRetake={() => {}} />);

    expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
  });
});
