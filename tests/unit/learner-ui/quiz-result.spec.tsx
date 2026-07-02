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
});
