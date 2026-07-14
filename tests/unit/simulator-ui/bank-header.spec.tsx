/**
 * BankHeader — title + low-noise corner icon actions (edit/delete) for the
 * bank detail page. `BankEditForm` is hidden by default, revealed only
 * when the pencil icon button is toggled. `BankDeleteAction` (mocked here)
 * owns its own confirm-dialog flow — this component just places its icon
 * trigger in the corner.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-edit-form', () => ({
  BankEditForm: () => <div data-testid="bank-edit-form">edit form</div>,
}));

vi.mock('../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-delete-action', () => ({
  BankDeleteAction: () => <button aria-label="Eliminar banco">delete trigger</button>,
}));

describe('BankHeader', () => {
  it('renders the bank title and does not show the edit form by default', async () => {
    const { BankHeader } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-header'
    );

    render(<BankHeader bankId="bank-1" title="Banco de álgebra" description="" />);

    expect(screen.getByText('Banco de álgebra')).toBeInTheDocument();
    expect(screen.queryByTestId('bank-edit-form')).not.toBeInTheDocument();
  });

  it('renders the edit and delete icon buttons with accessible labels', async () => {
    const { BankHeader } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-header'
    );

    render(<BankHeader bankId="bank-1" title="Banco de álgebra" description="" />);

    expect(screen.getByRole('button', { name: 'Editar banco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar banco' })).toBeInTheDocument();
  });

  it('toggles the edit form open and closed when the pencil button is clicked', async () => {
    const { BankHeader } = await import(
      '../../../src/app/dashboard/simulators/banks/[bankId]/_components/bank-header'
    );

    render(<BankHeader bankId="bank-1" title="Banco de álgebra" description="" />);
    const editButton = screen.getByRole('button', { name: 'Editar banco' });

    expect(editButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(editButton);
    expect(screen.getByTestId('bank-edit-form')).toBeInTheDocument();
    expect(editButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(editButton);
    expect(screen.queryByTestId('bank-edit-form')).not.toBeInTheDocument();
  });
});
