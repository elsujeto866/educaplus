/**
 * AttemptRunner — 'use client' island tests, Slice S5 addition: a
 * "Ver certificado" link to this simulator's certificate route appears in
 * the result view when the attempt is already finished AND passed on
 * mount. Mirrors `tests/unit/learner-ui/quiz-runner.spec.tsx`'s
 * `certificateHref` coverage. Mocks the Server Action module (same pattern
 * as quiz-runner.spec.tsx) so this never touches the real DB client.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AttemptView } from '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/_lib/attempt-view';

const submitAttemptActionMock = vi.fn();
vi.mock(
  '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/actions',
  () => ({
    submitAttemptAction: (attemptId: string, prevState: unknown, formData: FormData) =>
      submitAttemptActionMock(attemptId, prevState, formData),
  }),
);

function makeAttempt(overrides: Partial<AttemptView> = {}): AttemptView {
  return {
    id: 'attempt-1',
    simulatorId: 'sim-1',
    status: 'submitted',
    deadlineAt: new Date(Date.now() + 60_000).toISOString(),
    questions: [
      { id: 'q-1', prompt: '2+2', options: [{ id: 'a', label: '3' }, { id: 'b', label: '4' }] },
    ],
    score: 90,
    passed: true,
    ...overrides,
  };
}

describe('AttemptRunner', () => {
  it('shows a "Ver certificado" link to this simulator\'s certificate route when already passed on mount', async () => {
    const { AttemptRunner } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/_components/attempt-runner'
    );

    render(<AttemptRunner attempt={makeAttempt()} />);

    const link = screen.getByRole('link', { name: /ver certificado/i });
    expect(link).toHaveAttribute('href', '/dashboard/learn/simulators/sim-1/certificate');
  });

  it('hides the "Ver certificado" link when the finished attempt did not pass', async () => {
    const { AttemptRunner } = await import(
      '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/_components/attempt-runner'
    );

    render(<AttemptRunner attempt={makeAttempt({ status: 'submitted', passed: false, score: 40 })} />);

    expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
  });

  describe('issuesCertificate=false (Slice S6)', () => {
    it('hides the "Ver certificado" link even when passed, if issuesCertificate is false', async () => {
      const { AttemptRunner } = await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/_components/attempt-runner'
      );

      render(<AttemptRunner attempt={makeAttempt()} issuesCertificate={false} />);

      expect(screen.queryByRole('link', { name: /ver certificado/i })).not.toBeInTheDocument();
    });

    it('shows the "Ver certificado" link when passed and issuesCertificate is true (default)', async () => {
      const { AttemptRunner } = await import(
        '../../../src/app/dashboard/learn/simulators/[simulatorId]/attempt/[attemptId]/_components/attempt-runner'
      );

      render(<AttemptRunner attempt={makeAttempt()} issuesCertificate />);

      expect(screen.getByRole('link', { name: /ver certificado/i })).toBeInTheDocument();
    });
  });
});
