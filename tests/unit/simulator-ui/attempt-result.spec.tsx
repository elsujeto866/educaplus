/**
 * AttemptResult — presentational result view. Mirrors
 * `tests/unit/learner-ui/quiz-result.spec.tsx`'s `certificateHref` coverage
 * (Slice S5): a "Ver certificado" link appears ONLY when `passed` is true
 * AND `certificateHref` is provided — never leaks per-question correctness.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttemptResult } from '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/_components/attempt-result';

describe('AttemptResult', () => {
  it('shows the score and a PASSED badge when passed is true', () => {
    render(<AttemptResult score={80} passed status="submitted" />);

    expect(screen.getByText('80 / 100')).toBeInTheDocument();
    expect(screen.getByText(/aprobado/i)).toBeInTheDocument();
  });

  it('shows a FAILED badge when passed is false', () => {
    render(<AttemptResult score={40} passed={false} status="submitted" />);

    expect(screen.getByText('40 / 100')).toBeInTheDocument();
    expect(screen.getByText(/desaprobado/i)).toBeInTheDocument();
  });

  it('shows a "Ver certificado" link when passed and certificateHref is provided', () => {
    render(
      <AttemptResult
        score={90}
        passed
        status="submitted"
        certificateHref="/dashboard/learn/simulators/sim-1/certificate"
      />,
    );

    const link = screen.getByRole('link', { name: /ver certificado/i });
    expect(link).toHaveAttribute('href', '/dashboard/learn/simulators/sim-1/certificate');
  });

  it('hides the "Ver certificado" link when not passed, even with certificateHref provided', () => {
    render(
      <AttemptResult
        score={40}
        passed={false}
        status="submitted"
        certificateHref="/dashboard/learn/simulators/sim-1/certificate"
      />,
    );

    expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
  });

  it('hides the "Ver certificado" link when passed but certificateHref is not provided', () => {
    render(<AttemptResult score={90} passed status="submitted" />);

    expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
  });
});
