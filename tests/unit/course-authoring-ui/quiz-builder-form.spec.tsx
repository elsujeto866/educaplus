/**
 * QuizBuilderForm behavioral tests — the quiz builder's top-level 'use
 * client' island. The real `saveQuizAction` Server Action is mocked so this
 * exercises the component's OWN wiring: `useReducer(quizReducer)` +
 * `useActionState(saveQuizAction)`, add/remove/reorder question+option,
 * exclusive radio-correct selection, submit-enablement gated by
 * `validateQuizDraft`, and error surfacing without losing entered data.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ActionResult } from '../../../src/app/dashboard/courses/_lib/action-result';

const saveQuizActionMock =
  vi.fn<(courseId: string, prev: ActionResult, formData: FormData) => Promise<ActionResult>>();
vi.mock('../../../src/app/dashboard/courses/[courseId]/quiz/actions', () => ({
  saveQuizAction: (courseId: string, prev: ActionResult, formData: FormData) =>
    saveQuizActionMock(courseId, prev, formData),
}));

async function loadForm() {
  const { QuizBuilderForm } = await import(
    '../../../src/app/dashboard/courses/[courseId]/quiz/_components/quiz-builder-form'
  );
  return QuizBuilderForm;
}

describe('QuizBuilderForm', () => {
  it('renders an empty draft with an "Agregar pregunta" control and submit enabled', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(
      <QuizBuilderForm
        courseId="course-1"
        initialTitle=""
        initialPassingScore={70}
        initialQuestions={[]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Agregar pregunta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar evaluación' })).not.toBeDisabled();
    expect(screen.queryByText(/Pregunta 1/)).not.toBeInTheDocument();
  });

  it('renders the passing-score field prefilled from initialPassingScore', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(
      <QuizBuilderForm
        courseId="course-1"
        initialTitle=""
        initialPassingScore={80}
        initialQuestions={[]}
      />,
    );

    expect(screen.getByLabelText('Puntaje mínimo para aprobar (%)')).toHaveValue(80);
  });

  it('blocks submit and shows a validation message when passing score is above 100', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(
      <QuizBuilderForm
        courseId="course-1"
        initialTitle=""
        initialPassingScore={70}
        initialQuestions={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Puntaje mínimo para aprobar (%)'), {
      target: { value: '150' },
    });

    expect(screen.getByRole('button', { name: 'Guardar evaluación' })).toBeDisabled();
    expect(screen.getByText('El puntaje debe ser un entero entre 0 y 100.')).toBeInTheDocument();
  });

  it('blocks submit and shows a validation message when passing score is negative', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(
      <QuizBuilderForm
        courseId="course-1"
        initialTitle=""
        initialPassingScore={70}
        initialQuestions={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Puntaje mínimo para aprobar (%)'), {
      target: { value: '-1' },
    });

    expect(screen.getByRole('button', { name: 'Guardar evaluación' })).toBeDisabled();
    expect(screen.getByText('El puntaje debe ser un entero entre 0 y 100.')).toBeInTheDocument();
  });

  it('adding a question renders its editor and disables submit until it is well-formed', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(<QuizBuilderForm courseId="course-1" initialTitle="" initialPassingScore={70} initialQuestions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

    expect(screen.getByText('Pregunta 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar evaluación' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Enunciado de la pregunta 1'), {
      target: { value: '2 + 2?' },
    });
    fireEvent.change(screen.getByLabelText('Opción 1 de la pregunta 1'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Opción 2 de la pregunta 1'), {
      target: { value: '4' },
    });

    expect(screen.getByRole('button', { name: 'Guardar evaluación' })).not.toBeDisabled();
  });

  it('blocks removing an option below the 2-option minimum', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(<QuizBuilderForm courseId="course-1" initialTitle="" initialPassingScore={70} initialQuestions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

    expect(
      screen.getByRole('button', { name: 'Quitar opción 1 de la pregunta 1' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Quitar opción 2 de la pregunta 1' }),
    ).toBeDisabled();
  });

  it('adding an option allows removal and both new options are editable', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(<QuizBuilderForm courseId="course-1" initialTitle="" initialPassingScore={70} initialQuestions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar opción' }));

    expect(screen.getByLabelText('Opción 3 de la pregunta 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Quitar opción 3 de la pregunta 1' }),
    ).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Quitar opción 3 de la pregunta 1' }));
    expect(screen.queryByLabelText('Opción 3 de la pregunta 1')).not.toBeInTheDocument();
  });

  it('selecting a new correct option unselects the previous one (exclusive radio)', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(<QuizBuilderForm courseId="course-1" initialTitle="" initialPassingScore={70} initialQuestions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));

    const radioA = screen.getByRole('radio', { name: 'Marcar opción 1 de la pregunta 1 como correcta' });
    const radioB = screen.getByRole('radio', { name: 'Marcar opción 2 de la pregunta 1 como correcta' });

    expect(radioA).toBeChecked();
    expect(radioB).not.toBeChecked();

    fireEvent.click(radioB);

    expect(radioA).not.toBeChecked();
    expect(radioB).toBeChecked();
  });

  it('reorders questions: moving the 2nd question up swaps it with the 1st', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(<QuizBuilderForm courseId="course-1" initialTitle="" initialPassingScore={70} initialQuestions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
    fireEvent.change(screen.getByLabelText('Enunciado de la pregunta 1'), {
      target: { value: 'First question' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
    fireEvent.change(screen.getByLabelText('Enunciado de la pregunta 2'), {
      target: { value: 'Second question' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mover pregunta 2 arriba' }));

    expect(screen.getByLabelText('Enunciado de la pregunta 1')).toHaveValue('Second question');
    expect(screen.getByLabelText('Enunciado de la pregunta 2')).toHaveValue('First question');
  });

  it('removing a question drops its editor from the form', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: true });
    const QuizBuilderForm = await loadForm();
    render(<QuizBuilderForm courseId="course-1" initialTitle="" initialPassingScore={70} initialQuestions={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar pregunta 1' }));

    expect(screen.queryByText('Pregunta 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar evaluación' })).not.toBeDisabled();
  });

  it('shows the action error via role="alert" without losing entered data', async () => {
    saveQuizActionMock.mockResolvedValue({ ok: false, error: 'No se pudo guardar la evaluación.' });
    const QuizBuilderForm = await loadForm();
    render(<QuizBuilderForm courseId="course-1" initialTitle="Evaluación final" initialPassingScore={70} initialQuestions={[]} />);

    fireEvent.change(screen.getByLabelText('Título de la evaluación'), {
      target: { value: 'Evaluación final editada' },
    });
    const form = screen.getByRole('button', { name: 'Guardar evaluación' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar la evaluación.');
    });
    expect(screen.getByLabelText('Título de la evaluación')).toHaveValue('Evaluación final editada');
  });
});
