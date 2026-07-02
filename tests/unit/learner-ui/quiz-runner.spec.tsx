/**
 * QuizRunner — 'use client' island tests (spec.md's "Quiz Rendering and
 * Selection Gate" / "Attempt Submission and Result Display" / "Retake
 * resets the form" / "Already-passed student sees passed state on load").
 * Mocks the Server Action module (same pattern as
 * mark-complete-button.spec.tsx) and lets the real `useActionState` run.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { QuizView } from '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_lib/quiz-view';

const saveAttemptActionMock = vi.fn();
vi.mock('../../../src/app/dashboard/learn/courses/[courseId]/quiz/actions', () => ({
  saveAttemptAction: (courseId: string, prevState: unknown, formData: FormData) =>
    saveAttemptActionMock(courseId, prevState, formData),
}));

const quiz: QuizView = {
  id: 'assess-1',
  courseId: 'course-1',
  title: 'Evaluación final',
  questions: [
    {
      id: 'q-1',
      prompt: '2 + 2?',
      options: [
        { id: 'opt-1', label: '3' },
        { id: 'opt-2', label: '4' },
      ],
    },
    {
      id: 'q-2',
      prompt: '3 + 3?',
      options: [
        { id: 'opt-3', label: '5' },
        { id: 'opt-4', label: '6' },
      ],
    },
  ],
};

describe('QuizRunner', () => {
  beforeEach(() => {
    saveAttemptActionMock.mockReset();
  });

  it('renders every question with its options as radio inputs, none pre-selected', async () => {
    const { QuizRunner } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_components/quiz-runner'
    );

    render(<QuizRunner courseId="course-1" quiz={quiz} latest={null} />);

    expect(screen.getByText(/2 \+ 2\?/)).toBeInTheDocument();
    expect(screen.getByText(/3 \+ 3\?/)).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
  });

  it('keeps submit disabled until every question has exactly one selection', async () => {
    const { QuizRunner } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_components/quiz-runner'
    );

    render(<QuizRunner courseId="course-1" quiz={quiz} latest={null} />);
    const submit = screen.getByRole('button', { name: /enviar respuestas/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '6' }));
    expect(submit).toBeEnabled();
  });

  it('submits the JSON payload and renders QuizResult on a successful action', async () => {
    saveAttemptActionMock.mockResolvedValue({ ok: true, score: 100, passed: true });
    const { QuizRunner } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_components/quiz-runner'
    );

    render(<QuizRunner courseId="course-1" quiz={quiz} latest={null} />);
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByRole('radio', { name: '6' }));
    fireEvent.click(screen.getByRole('button', { name: /enviar respuestas/i }));

    await waitFor(() => {
      expect(saveAttemptActionMock).toHaveBeenCalledWith(
        'course-1',
        expect.anything(),
        expect.any(FormData),
      );
    });

    const [, , formData] = saveAttemptActionMock.mock.calls[0] as [string, unknown, FormData];
    const payload = JSON.parse(formData.get('payload') as string);
    expect(payload).toEqual([
      { questionId: 'q-1', selectedOptionId: 'opt-2' },
      { questionId: 'q-2', selectedOptionId: 'opt-4' },
    ]);

    expect(await screen.findByText('100 / 100')).toBeInTheDocument();
    expect(screen.getByText(/aprobado/i)).toBeInTheDocument();
  });

  it('renders a passed indicator immediately when a latest passed attempt is provided', async () => {
    const { QuizRunner } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_components/quiz-runner'
    );

    render(
      <QuizRunner courseId="course-1" quiz={quiz} latest={{ score: 90, passed: true }} />,
    );

    expect(screen.getByText('90 / 100')).toBeInTheDocument();
    expect(screen.getByText(/aprobado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a intentar/i })).toBeInTheDocument();
  });

  it('retake re-opens the form with no pre-selected answers and submit disabled', async () => {
    const { QuizRunner } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_components/quiz-runner'
    );

    render(
      <QuizRunner courseId="course-1" quiz={quiz} latest={{ score: 90, passed: true }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /volver a intentar/i }));

    expect(screen.getByText(/2 \+ 2\?/)).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: /enviar respuestas/i })).toBeDisabled();
  });

  it('shows a "Ver certificado" link to this course\'s certificate route when passed', async () => {
    const { QuizRunner } = await import(
      '../../../src/app/dashboard/learn/courses/[courseId]/quiz/_components/quiz-runner'
    );

    render(
      <QuizRunner courseId="course-1" quiz={quiz} latest={{ score: 90, passed: true }} />,
    );

    const link = screen.getByRole('link', { name: /ver certificado/i });
    expect(link).toHaveAttribute('href', '/dashboard/learn/courses/course-1/certificate');
  });
});
