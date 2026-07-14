/**
 * QuestionActionsToolbar — "Agregar pregunta" / "Importar CSV" buttons that
 * toggle `QuestionFormCard` (add mode) / `CsvImportForm` open and closed.
 * Both forms are mocked to plain markers: this test only verifies the
 * toggle wiring, not the forms' own internals (covered elsewhere).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-form-card', () => ({
  QuestionFormCard: () => <div data-testid="question-form-card">add form</div>,
}));

vi.mock('../../../src/app/dashboard/simulators/banks/[bankId]/_components/csv-import-form', () => ({
  CsvImportForm: () => <div data-testid="csv-import-form">csv form</div>,
}));

describe('QuestionActionsToolbar', () => {
  it('does not render the add form or the CSV form by default', async () => {
    const { QuestionActionsToolbar } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-actions-toolbar'
    );

    render(<QuestionActionsToolbar bankId="bank-1" />);

    expect(screen.queryByTestId('question-form-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('csv-import-form')).not.toBeInTheDocument();
  });

  it('toggles the add-question form open and closed', async () => {
    const { QuestionActionsToolbar } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-actions-toolbar'
    );

    render(<QuestionActionsToolbar bankId="bank-1" />);
    const addButton = screen.getByRole('button', { name: /agregar pregunta/i });

    fireEvent.click(addButton);
    expect(screen.getByTestId('question-form-card')).toBeInTheDocument();

    fireEvent.click(addButton);
    expect(screen.queryByTestId('question-form-card')).not.toBeInTheDocument();
  });

  it('toggles the CSV import form open and closed', async () => {
    const { QuestionActionsToolbar } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/question-actions-toolbar'
    );

    render(<QuestionActionsToolbar bankId="bank-1" />);
    const importButton = screen.getByRole('button', { name: /importar csv/i });

    fireEvent.click(importButton);
    expect(screen.getByTestId('csv-import-form')).toBeInTheDocument();

    fireEvent.click(importButton);
    expect(screen.queryByTestId('csv-import-form')).not.toBeInTheDocument();
  });
});
