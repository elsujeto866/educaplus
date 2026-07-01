import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../../../src/shared/ui/atoms/textarea';

describe('Textarea', () => {
  it('accepts and displays multiline typed input', () => {
    render(<Textarea aria-label="Descripción" />);
    const textarea = screen.getByLabelText('Descripción');

    fireEvent.change(textarea, { target: { value: 'Línea uno\nLínea dos' } });

    expect(textarea).toHaveValue('Línea uno\nLínea dos');
  });

  it('respects the rows prop', () => {
    render(<Textarea aria-label="Descripción" rows={6} />);
    expect(screen.getByLabelText('Descripción')).toHaveAttribute('rows', '6');
  });
});
