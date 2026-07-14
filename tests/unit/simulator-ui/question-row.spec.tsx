/**
 * QuestionRow — compact collapsed row (position, truncated prompt, topic/
 * difficulty badges, chevron) that expands on click to reveal the full
 * options list plus edit/delete corner icon buttons. Edit/delete are
 * intentionally invisible while collapsed (redesign brief: "expand-to-act").
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const deleteQuestionAction = vi.fn();

vi.mock('../../../src/app/dashboard/simulators/banks/[bankId]/actions', () => ({
  deleteQuestionAction: (...args: unknown[]) => deleteQuestionAction(...args),
}));

vi.mock('../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-form-card', () => ({
  QuestionFormCard: () => <div data-testid="question-form-card">edit form</div>,
}));

function makeQuestion() {
  return {
    id: 'question-1',
    prompt: '¿Cuánto es 2 + 2?',
    topic: 'Aritmética',
    difficulty: 'easy' as const,
    explanation: null,
    options: [
      { id: 'opt-a', label: '3' },
      { id: 'opt-b', label: '4' },
    ],
    correctOptionId: 'opt-b',
  };
}

describe('QuestionRow', () => {
  it('renders collapsed by default: position, prompt, badges — no options, no edit/delete', async () => {
    const { QuestionRow } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-row'
    );

    render(<QuestionRow bankId="bank-1" question={makeQuestion()} position={1} />);

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('¿Cuánto es 2 + 2?')).toBeInTheDocument();
    expect(screen.getByText('Aritmética')).toBeInTheDocument();
    expect(screen.getByText('Fácil')).toBeInTheDocument();

    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.queryByText('4')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar pregunta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar pregunta' })).not.toBeInTheDocument();
  });

  it('has an aria-expanded toggle that starts collapsed', async () => {
    const { QuestionRow } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-row'
    );

    render(<QuestionRow bankId="bank-1" question={makeQuestion()} position={1} />);

    expect(screen.getByRole('button', { name: /¿Cuánto es 2 \+ 2\?/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands on click to reveal options and the edit/delete icon buttons', async () => {
    const { QuestionRow } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-row'
    );

    render(<QuestionRow bankId="bank-1" question={makeQuestion()} position={1} />);
    const toggle = screen.getByRole('button', { name: /¿Cuánto es 2 \+ 2\?/ });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/4\s*✓/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar pregunta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar pregunta' })).toBeInTheDocument();
  });

  it('collapses again on a second click, hiding options and edit/delete', async () => {
    const { QuestionRow } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-row'
    );

    render(<QuestionRow bankId="bank-1" question={makeQuestion()} position={1} />);
    const toggle = screen.getByRole('button', { name: /¿Cuánto es 2 \+ 2\?/ });

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Editar pregunta' })).not.toBeInTheDocument();
  });

  it('shows the edit form when the pencil icon button is clicked', async () => {
    const { QuestionRow } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-row'
    );

    render(<QuestionRow bankId="bank-1" question={makeQuestion()} position={1} />);
    fireEvent.click(screen.getByRole('button', { name: /¿Cuánto es 2 \+ 2\?/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar pregunta' }));

    expect(screen.getByTestId('question-form-card')).toBeInTheDocument();
  });

  it('opens a confirm dialog and deletes the question on confirm', async () => {
    const { QuestionRow } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-row'
    );

    render(<QuestionRow bankId="bank-1" question={makeQuestion()} position={1} />);
    fireEvent.click(screen.getByRole('button', { name: /¿Cuánto es 2 \+ 2\?/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar pregunta' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(deleteQuestionAction).toHaveBeenCalledWith('bank-1', 'question-1', expect.any(FormData));
  });
});
