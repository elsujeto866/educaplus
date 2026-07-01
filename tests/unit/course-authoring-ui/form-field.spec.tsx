import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../../../src/shared/ui/molecules/form-field';

describe('FormField', () => {
  it('associates the label with its control via htmlFor/id and renders no error by default', () => {
    render(
      <FormField label="Título" htmlFor="title">
        <input id="title" />
      </FormField>,
    );

    expect(screen.getByLabelText('Título')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the error message with role="alert" when an error is given', () => {
    render(
      <FormField label="Título" htmlFor="title" error="El título es obligatorio.">
        <input id="title" />
      </FormField>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('El título es obligatorio.');
  });
});
